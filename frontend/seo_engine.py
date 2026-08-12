"""
seo_engine.py
=================================================================
Ports the crawler + XGBoost scoring + issue-detection + gamification
logic from the original Streamlit `app.py` into plain Python so the
Django "frontend" app can call it directly from a view.

Drop this file into:  Project/frontend/seo_engine.py
Model files (xgb_real_seo_model.pkl, real_scaler.pkl,
real_feature_cols.pkl) must live in:  Project/models/
(see settings.py MODELS_DIR).
=================================================================
"""
import pickle
import re
import time
import warnings
from functools import lru_cache

import numpy as np
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from django.conf import settings

warnings.filterwarnings("ignore")

# =============================================================================
# CUSTOM CLASSES — must exist at import time for pickle to resolve them
# =============================================================================
class CustomStandardScaler:
    def __init__(self):
        self.mean_ = None
        self.std_ = None

    def fit(self, X):
        self.mean_ = X.mean(axis=0)
        self.std_ = X.std(axis=0)
        self.std_[self.std_ == 0] = 1.0
        return self

    def transform(self, X):
        return (X - self.mean_) / self.std_

    def fit_transform(self, X):
        return self.fit(X).transform(X)


class CustomLinearRegression:
    def __init__(self, **kwargs):
        self.W = None
        self.b = 0.0
        self.train_loss = []
        self.val_loss = []

    def predict(self, X):
        return X @ self.W + self.b


class CustomUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if name == "CustomStandardScaler":
            return CustomStandardScaler
        if name == "CustomLinearRegression":
            return CustomLinearRegression
        return super().find_class(module, name)


# =============================================================================
# MODEL LOADING (cached — loaded once per process, like st.cache_resource)
# =============================================================================
@lru_cache(maxsize=1)
def load_models():
    model_dir = settings.MODELS_DIR
    with open(model_dir / "xgb_real_seo_model.pkl", "rb") as f:
        mdl = CustomUnpickler(f).load()
    with open(model_dir / "real_scaler.pkl", "rb") as f:
        scl = CustomUnpickler(f).load()
    with open(model_dir / "real_feature_cols.pkl", "rb") as f:
        cols = CustomUnpickler(f).load()
    return mdl, scl, cols


# =============================================================================
# CRAWLER  (identical logic to the Streamlit app's crawl_url)
# =============================================================================
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
}


def crawl_url(url):
    raw = {"url": url}
    try:
        t0 = time.time()
        r = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True)
        raw["page_load_time_sec"] = round(time.time() - t0, 3)
        raw["http_status_code"] = r.status_code
        raw["is_https"] = int(url.startswith("https"))
        raw["content_size_bytes"] = len(r.content)
        if r.status_code != 200:
            raw["crawl_status"] = f"HTTP {r.status_code}"
            return raw
        soup = BeautifulSoup(r.text, "html.parser")
        pb = urlparse(url)

        tt = soup.find("title")
        title = tt.get_text(strip=True) if tt else ""
        raw.update(
            {
                "has_title_tag": int(bool(title)),
                "title_text": title,
                "title_length": len(title),
                "title_optimal": int(30 <= len(title) <= 60),
                "title_one_word": int(len(title.split()) == 1),
            }
        )

        md = soup.find("meta", attrs={"name": re.compile("description", re.I)})
        desc = md.get("content", "").strip() if md else ""
        raw.update(
            {
                "has_meta_description": int(bool(desc)),
                "meta_description_text": desc,
                "meta_description_length": len(desc),
                "meta_desc_optimal": int(120 <= len(desc) <= 160),
            }
        )

        can = soup.find("link", rel=lambda x: x and "canonical" in x)
        can_url = can.get("href", "") if can else ""
        raw["has_canonical"] = int(bool(can_url))
        raw["canonical_url"] = can_url

        rob = soup.find("meta", attrs={"name": re.compile("robots", re.I)})
        rob_c = rob.get("content", "").lower() if rob else ""
        raw["is_noindex"] = int("noindex" in rob_c)
        raw["is_nofollow"] = int("nofollow" in rob_c)

        ct = r.headers.get("content-type", "")
        http_cs = (
            ct.lower().split("charset=")[-1].strip() if "charset=" in ct.lower() else ""
        )
        hc_tag = soup.find("meta", attrs={"charset": True})
        html_cs = hc_tag.get("charset", "").lower() if hc_tag else ""
        raw["charset_conflict"] = int(
            bool(http_cs) and bool(html_cs) and http_cs != html_cs
        )
        raw["http_charset"] = http_cs
        raw["html_charset"] = html_cs

        h1s = soup.find_all("h1")
        h2s = soup.find_all("h2")
        all_h = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        h1_text = h1s[0].get_text(strip=True) if h1s else ""
        raw.update(
            {
                "h1_count": len(h1s),
                "h1_text_first": h1_text,
                "h1_length_first": len(h1_text),
                "h1_too_short": int(bool(h1s) and len(h1_text) < 20),
                "has_exactly_one_h1": int(len(h1s) == 1),
                "h2_count": len(h2s),
                "total_headings": len(all_h),
                "too_many_headings": int(len(all_h) > 15),
            }
        )

        text = soup.get_text(separator=" ", strip=True)
        words = re.findall(r"[A-Za-z']+", text)
        wc = len(words)
        raw["word_count"] = wc
        raw["content_sufficient"] = int(wc >= 300)

        bolds = soup.find_all(["b", "strong"])
        bold_texts = [b.get_text(strip=True).lower() for b in bolds if b.get_text(strip=True)]
        counts = {}
        for t in bold_texts:
            counts[t] = counts.get(t, 0) + 1
        repeated = [t for t, c in counts.items() if c >= 3]
        raw["has_bold_stuffing"] = int(bool(repeated))
        raw["repeated_bold_tags"] = repeated

        imgs = soup.find_all("img")
        no_alt = [i for i in imgs if not i.get("alt", "").strip()]
        raw["total_images"] = len(imgs)
        raw["images_missing_alt"] = len(no_alt)
        raw["alt_text_score"] = (
            round(1 - len(no_alt) / len(imgs), 2) if imgs else 1.0
        )

        links = soup.find_all("a", href=True)
        internal_l, external_l, dyn_internal, no_anchor = [], [], 0, 0
        for a in links:
            href = a["href"]
            anchor = a.get_text(strip=True)
            if not anchor:
                no_anchor += 1
            if href.startswith("http") and pb.netloc not in href:
                external_l.append(href)
            else:
                internal_l.append(href)
                if "?" in href and "nofollow" not in (a.get("rel") or []):
                    dyn_internal += 1
        raw.update(
            {
                "internal_link_count": len(internal_l),
                "external_link_count": len(external_l),
                "total_link_count": len(links),
                "no_anchor_count": no_anchor,
                "dynamic_internal_links": dyn_internal,
                "too_many_external": int(len(external_l) > 50),
            }
        )

        raw["has_viewport_meta"] = int(
            bool(soup.find("meta", attrs={"name": re.compile("viewport", re.I)}))
        )
        raw["has_schema_markup"] = int(
            len(soup.find_all("script", type="application/ld+json")) > 0
        )
        raw["has_og_tags"] = int(bool(soup.find("meta", property="og:title")))
        raw["has_frames"] = int(len(soup.find_all(["frame", "iframe"])) > 0)

        slug = pb.path.rstrip("/").split("/")[-1] if pb.path else ""
        raw["url_path_depth"] = len([s for s in pb.path.split("/") if s])
        raw["url_has_query_params"] = int(bool(pb.query))
        raw["url_slug_has_hyphens"] = int("-" in slug)
        raw["url_length"] = len(url)

        try:
            rb = requests.get(
                f"{pb.scheme}://{pb.netloc}/robots.txt", timeout=5, headers=HEADERS
            )
            raw["has_robots_txt"] = int(rb.status_code == 200)
        except Exception:
            raw["has_robots_txt"] = 0

        # top keywords (used by keyword-density chart, optional)
        stop_words = {
            "the","a","an","and","or","but","in","on","at","to","for","of","with",
            "by","from","is","was","are","were","be","been","has","have","had","do",
            "does","did","will","would","could","should","this","that","it","its",
        }
        kw_counts = {}
        for w in words:
            wl = w.lower()
            if wl in stop_words or len(wl) < 3:
                continue
            kw_counts[wl] = kw_counts.get(wl, 0) + 1
        top = sorted(kw_counts.items(), key=lambda kv: -kv[1])[:8]
        raw["top_keywords"] = [
            {"keyword": k, "density": round(c / max(wc, 1) * 100, 2)} for k, c in top
        ]

        raw["crawl_status"] = "OK"
    except requests.exceptions.Timeout:
        raw["crawl_status"] = "TIMEOUT"
        raw["http_status_code"] = 0
        raw["page_load_time_sec"] = 12
    except Exception as e:
        raw["crawl_status"] = f"ERROR: {str(e)[:120]}"
        raw["http_status_code"] = 0
    return raw


# =============================================================================
# CATEGORY SCORING  (identical logic to Streamlit app's compute_categories)
# =============================================================================
def compute_categories(raw):
    def meta():
        s = 0
        if raw.get("has_title_tag"): s += 15
        if raw.get("title_optimal"): s += 20
        if not raw.get("title_one_word"): s += 10
        if raw.get("has_meta_description"): s += 25
        if raw.get("meta_desc_optimal"): s += 20
        if raw.get("has_canonical"): s += 10
        return min(s, 100)

    def quality():
        s = 0
        if raw.get("content_sufficient"): s += 30
        if not raw.get("has_frames"): s += 15
        if raw.get("has_viewport_meta"): s += 20
        if raw.get("alt_text_score", 0) > 0.9: s += 15
        if not raw.get("has_bold_stuffing"): s += 10
        if raw.get("has_og_tags"): s += 10
        return min(s, 100)

    def structure():
        s = 0
        if raw.get("has_exactly_one_h1"): s += 30
        if raw.get("h1_length_first", 0) >= 20: s += 20
        if raw.get("h2_count", 0) >= 2: s += 20
        if not raw.get("too_many_headings"): s += 15
        if not raw.get("is_noindex"): s += 15
        return min(s, 100)

    def links():
        s = 0
        if raw.get("internal_link_count", 0) >= 5: s += 30
        if raw.get("no_anchor_count", 99) == 0: s += 20
        if not raw.get("too_many_external"): s += 25
        if raw.get("dynamic_internal_links", 1) == 0: s += 25
        return min(s, 100)

    def server():
        s = 0
        if raw.get("is_https"): s += 35
        if raw.get("http_status_code") == 200: s += 35
        lt = raw.get("page_load_time_sec", 99)
        if lt < 2: s += 30
        elif lt < 4: s += 15
        return min(s, 100)

    def external():
        s = 0
        if raw.get("has_robots_txt"): s += 34
        if not raw.get("is_noindex"): s += 33
        if raw.get("has_schema_markup"): s += 33
        return min(s, 100)

    cats = {
        "Meta information": meta(),
        "Page quality": quality(),
        "Page structure": structure(),
        "Links": links(),
        "Server": server(),
        "External factors": external(),
    }
    overall = round(
        sum([cats[k] * w for k, w in zip(cats, [0.20, 0.20, 0.15, 0.15, 0.15, 0.15])])
    )
    return cats, overall


def ml_predict(raw):
    model, scaler, feature_cols = load_models()
    row = {col: raw.get(col, 0) for col in feature_cols}
    X = np.array([[row[c] for c in feature_cols]], dtype=np.float64)
    return float(np.clip(model.predict(scaler.transform(X))[0], 0, 100))


# =============================================================================
# ISSUE DETECTION  (identical logic to Streamlit app's get_issues)
# =============================================================================
def get_issues(raw):
    issues = []

    def add(cat, check, status, detail, fix, imp):
        issues.append({"cat": cat, "check": check, "status": status, "detail": detail, "fix": fix, "imp": imp})

    tl = raw.get("title_length", 0)
    if not raw.get("has_title_tag"):
        add("Meta", "Title tag", "ERROR", "No title tag found.",
            "Add <title>Your Page Title</title> inside <head>", 3)
    elif not raw.get("title_optimal"):
        add("Meta", "Title tag", "WARNING", f"Title is {tl} chars — aim for 30–60 characters.",
            f"{'Expand' if tl < 30 else 'Shorten'} your title tag.", 3)

    if not raw.get("has_meta_description"):
        add("Meta", "Meta description", "ERROR", "Meta description is missing.",
            "Add <meta name='description' content='120–160 char summary'>", 3)
    elif not raw.get("meta_desc_optimal"):
        dl = raw.get("meta_description_length", 0)
        add("Meta", "Meta description", "WARNING", f"Meta description is {dl} chars — aim for 120–160.",
            f"{'Expand' if dl < 120 else 'Shorten'} your meta description.", 3)

    if not raw.get("has_canonical"):
        add("Meta", "Canonical URL", "WARNING", "No canonical tag found.",
            f"Add <link rel='canonical' href='{raw.get('url','')}'>", 2)

    h1c = raw.get("h1_count", 0)
    if h1c == 0:
        add("Structure", "H1 heading", "ERROR", "No H1 heading on this page.",
            "Add exactly one <h1> containing your primary keyword.", 3)
    elif raw.get("h1_too_short"):
        add("Structure", "H1 heading", "WARNING",
            f"H1 '{raw.get('h1_text_first','')}' is too short ({raw.get('h1_length_first',0)} chars).",
            "Rewrite H1 to be at least 20 characters and keyword-rich.", 3)
    elif h1c > 1:
        add("Structure", "H1 heading", "WARNING", f"{h1c} H1 tags found — should be exactly 1.",
            "Keep one H1 only; convert extras to H2.", 2)

    if raw.get("too_many_headings"):
        add("Structure", "Headings", "WARNING",
            f"{raw.get('total_headings',0)} headings — too many relative to word count.",
            "Reduce headings to properly reflect content structure.", 2)

    if not raw.get("content_sufficient"):
        add("Quality", "Word count", "ERROR", f"Only {raw.get('word_count',0)} words — need at least 300.",
            "Add more descriptive content to the page.", 3)

    if not raw.get("has_viewport_meta"):
        add("Quality", "Mobile viewport", "ERROR", "No viewport meta tag found.",
            "Add <meta name='viewport' content='width=device-width, initial-scale=1'>", 2)

    if raw.get("has_bold_stuffing"):
        for t in raw.get("repeated_bold_tags", [])[:1]:
            add("Quality", "Bold tags", "WARNING", f"Tag repeated too many times: '{t}'",
                "Reduce repeated bold phrases to avoid keyword stuffing.", 1)

    if raw.get("images_missing_alt", 0) > 0:
        add("Quality", "Image alt text", "WARNING", f"{raw.get('images_missing_alt')} images missing alt text.",
            "Add descriptive alt='...' to every image tag.", 2)

    if not raw.get("has_schema_markup"):
        add("External", "Schema markup", "WARNING", "No JSON-LD structured data found.",
            "Add Organization or Article schema for rich search snippets.", 2)

    if raw.get("dynamic_internal_links", 0) > 0:
        add("Links", "Internal links", "WARNING",
            f"{raw.get('dynamic_internal_links')} internal links have query parameters.",
            "Remove dynamic parameters from internal links not marked nofollow.", 2)

    if raw.get("too_many_external"):
        add("Links", "External links", "WARNING", f"{raw.get('external_link_count')} external links (>50 is too many).",
            "Reduce or add rel='nofollow' to less important external links.", 1)

    if raw.get("no_anchor_count", 0) > 0:
        add("Links", "Anchor text", "WARNING", f"{raw.get('no_anchor_count')} links have no anchor text.",
            "Add descriptive text inside every <a> tag.", 2)

    if raw.get("charset_conflict"):
        add("Meta", "Charset", "ERROR",
            f"Charset conflict: HTTP={raw.get('http_charset')} HTML={raw.get('html_charset')}",
            "Fix server Content-Type header: text/html; charset=utf-8", 1)

    if raw.get("is_noindex"):
        add("External", "Indexability", "ERROR", "Page is set to NOINDEX.",
            "Remove 'noindex' from robots meta tag unless intentional.", 3)

    if not raw.get("is_https"):
        add("Server", "HTTPS", "ERROR", "Site not served over HTTPS.",
            "Install SSL and redirect all HTTP to HTTPS.", 3)

    lt = raw.get("page_load_time_sec", 0)
    if lt > 3:
        add("Server", "Page speed", "ERROR" if lt > 5 else "WARNING",
            f"Page loaded in {lt}s — aim for under 3 seconds.",
            "Compress images, enable caching, and use a CDN.", 3)

    return sorted(issues, key=lambda x: -x["imp"])


# =============================================================================
# GAMIFICATION HELPERS  (identical logic to Streamlit app's gamification code)
# =============================================================================
def xp_for_task(imp):
    return 30 if imp == 3 else (20 if imp == 2 else 10)


def get_level(total_xp):
    levels = [
        (0, "Beginner", "#9e9e9e", 100),
        (100, "SEO Learner", "#78909c", 200),
        (300, "Optimizer", "#ffd54f", 300),
        (600, "SEO Expert", "#29b6f6", 400),
        (1000, "SEO Master", "#ff7043", 9999),
    ]
    for threshold, name, color, needed in reversed(levels):
        if total_xp >= threshold:
            return name, color, min((total_xp - threshold) / needed, 1.0), threshold + needed
    return levels[0][1], levels[0][2], 0.0, 100


BADGES = [
    {"id": "meta_master", "name": "Meta Master", "icon": "📝", "desc": "Fix all Meta issues", "cat": "Meta"},
    {"id": "quality_king", "name": "Quality King", "icon": "⭐", "desc": "Fix all Quality issues", "cat": "Quality"},
    {"id": "link_builder", "name": "Link Builder", "icon": "🔗", "desc": "Fix all Link issues", "cat": "Links"},
    {"id": "speed_racer", "name": "Speed Racer", "icon": "⚡", "desc": "Fix all Server issues", "cat": "Server"},
    {"id": "structure_pro", "name": "Structure Pro", "icon": "🏗️", "desc": "Fix all Structure issues", "cat": "Structure"},
    {"id": "seo_champion", "name": "SEO Champion", "icon": "🏆", "desc": "Complete ALL tasks", "cat": "ALL"},
]


def compute_earned_badges(issues, completed_keys):
    earned = set()
    if not issues:
        return earned
    for badge in BADGES:
        if badge["cat"] == "ALL":
            if len(completed_keys) == len(issues):
                earned.add(badge["id"])
        else:
            cat_issues = [i for i in issues if badge["cat"].lower() in i["cat"].lower()]
            if cat_issues and all(
                f"task_{idx}" in completed_keys
                for idx, i in enumerate(issues)
                if badge["cat"].lower() in i["cat"].lower()
            ):
                earned.add(badge["id"])
    return earned


# =============================================================================
# VIRTUAL WEB CONSOLE — dynamic task routing + Active Recall quiz bank
# (Action -> Feedback -> Reward loop, driven entirely by the audit's issues)
# =============================================================================
def get_task_type(issue):
    """Decide which console interaction an issue gets.
    - 'meta_desc' / 'title'  -> live text-rewrite drills (length-validated)
    - 'url_slug'             -> live URL-rewrite drill
    - 'quiz'                 -> Active Recall multiple-choice check
    """
    chk = issue["check"].lower()
    if "meta description" in chk:
        return "meta_desc"
    if chk == "title tag":
        return "title"
    if "url" in chk or "slug" in chk:
        return "url_slug"
    return "quiz"


QUIZ_BANK = {
    "Canonical URL": {
        "q": "A canonical tag primarily tells search engines...",
        "options": [
            "Which version of a duplicate/similar page is the 'master' copy to index",
            "How fast the page should load",
            "Which language the page is written in",
            "How many images are on the page"],
        "correct": 0,
        "explain": "Canonical tags resolve duplicate-content confusion by pointing crawlers to the preferred URL."},
    "H1 heading": {
        "q": "Why should a page have exactly one H1 tag?",
        "options": [
            "It makes the page load faster",
            "It gives crawlers one clear signal of the page's primary topic",
            "It is required by HTML syntax rules",
            "It increases the crawl budget"],
        "correct": 1,
        "explain": "A single, clear H1 acts as the strongest on-page relevance signal for the page's topic."},
    "Headings": {
        "q": "Why can an excessive number of headings hurt SEO?",
        "options": [
            "It dilutes topical focus and confuses the page's content hierarchy",
            "Search engines block pages with too many tags",
            "It slows down the CPU of the visitor's device",
            "It has no effect at all"],
        "correct": 0,
        "explain": "Too many headings relative to content flattens hierarchy and dilutes the page's topical signal."},
    "Word count": {
        "q": "Why do very thin pages (very few words) tend to rank poorly?",
        "options": [
            "Search engines can't render short pages",
            "They usually can't demonstrate enough topical depth/relevance to satisfy search intent",
            "Thin pages are automatically marked as spam",
            "Word count is a hard ranking factor with a fixed formula"],
        "correct": 1,
        "explain": "Thin content rarely covers a topic in enough depth to fully satisfy a searcher's intent."},
    "Mobile viewport": {
        "q": "What does the mobile viewport meta tag control?",
        "options": [
            "The page's title in search results",
            "How the page scales and lays out on mobile screen widths",
            "The server's HTTPS certificate",
            "The number of crawlable links"],
        "correct": 1,
        "explain": "The viewport tag tells mobile browsers how to scale content, which is core to mobile-friendliness (a ranking factor)."},
    "Bold tags": {
        "q": "Why is repeating the same bold phrase excessively a problem?",
        "options": [
            "It can look like manipulative keyword stuffing to search engines and users",
            "Bold text is not indexed at all",
            "It causes HTTP 500 errors",
            "It is not a problem at all"],
        "correct": 0,
        "explain": "Over-repeating a bolded phrase reads as manipulative emphasis/keyword stuffing rather than natural writing."},
    "Image alt text": {
        "q": "Alt text on images is mainly used for...",
        "options": [
            "Image SEO and accessibility (screen readers) when the image can't be seen/loaded",
            "Compressing the image file size",
            "Changing the image's file format",
            "Blocking the image from crawlers"],
        "correct": 0,
        "explain": "Alt text describes an image for accessibility tools and gives search engines context for image search."},
    "Schema markup": {
        "q": "What is the main benefit of adding JSON-LD schema markup?",
        "options": [
            "It guarantees the #1 ranking position",
            "It helps search engines understand structured data, enabling rich results/snippets",
            "It replaces the need for a title tag",
            "It encrypts the page"],
        "correct": 1,
        "explain": "Structured data helps engines parse entities/content precisely and can unlock rich snippets."},
    "Internal links": {
        "q": "Why should internal links avoid dynamic query parameters?",
        "options": [
            "Clean internal links preserve link equity and avoid wasting crawl budget on duplicate URL variants",
            "Query parameters are illegal in URLs",
            "Dynamic links load slower every time",
            "It has no real SEO effect"],
        "correct": 0,
        "explain": "Dynamic parameters can create near-duplicate URLs that fragment link equity and waste crawl budget."},
    "External links": {
        "q": "Why can too many external links on one page be a concern?",
        "options": [
            "It can dilute the page's authority and looks like a low-quality link farm",
            "Search engines only allow 10 links per page",
            "External links always trigger penalties",
            "It has no effect on SEO"],
        "correct": 0,
        "explain": "An excessive number of external links can dilute perceived authority and resemble link-farm behavior."},
    "Anchor text": {
        "q": "Why does descriptive anchor text (not 'click here') matter for links?",
        "options": [
            "It tells both users and crawlers what the linked page is about",
            "It changes the link's HTTP status code",
            "It is required for the link to be clickable",
            "It has no SEO relevance"],
        "correct": 0,
        "explain": "Descriptive anchor text is a relevance signal for the destination page's topic."},
    "Charset": {
        "q": "Why must the HTTP header charset and HTML meta charset match?",
        "options": [
            "Mismatches can cause text to render as garbled characters (mojibake) for users and crawlers",
            "It affects the page's load time only",
            "It changes the page's canonical URL",
            "It has no effect on rendering"],
        "correct": 0,
        "explain": "A charset mismatch between server headers and HTML can corrupt how text renders/parses."},
    "Indexability": {
        "q": "What does a 'noindex' directive tell a search engine?",
        "options": [
            "To crawl the page faster",
            "To exclude this page from its search index entirely",
            "To rank the page higher",
            "To only index the images on the page"],
        "correct": 1,
        "explain": "'noindex' explicitly instructs engines to leave the page out of the search index."},
    "HTTPS": {
        "q": "Why is serving a site over HTTPS (not HTTP) important for SEO?",
        "options": [
            "It's purely cosmetic and has no ranking impact",
            "It's a confirmed ranking signal and builds user trust via secure, encrypted connections",
            "It only affects image loading speed",
            "It is required only for e-commerce sites"],
        "correct": 1,
        "explain": "HTTPS is a confirmed (if lightweight) ranking signal and a baseline trust/security expectation."},
    "Page speed": {
        "q": "Why does slow page load time hurt SEO performance?",
        "options": [
            "It's tied to Core Web Vitals/UX signals and increases visitor bounce rate",
            "It only affects the developer's console logs",
            "Search engines cannot crawl slow pages at all",
            "It has no measurable effect"],
        "correct": 0,
        "explain": "Load speed feeds into Core Web Vitals (a ranking signal) and directly affects bounce/engagement rates."},
    "_default": {
        "q": "In the crawl -> index -> rank lifecycle, what happens first?",
        "options": ["Ranking", "Crawling", "Indexing", "Monetization"],
        "correct": 1,
        "explain": "A page must first be discovered/crawled before it can be indexed and later ranked."},
}


def build_game_tasks(issues, raw):
    """The gamified task set = the real detected issues, plus a live
    URL-rewrite drill whenever the crawled URL itself is non-semantic.
    Does not mutate the audit's `issues` output."""
    tasks = list(issues)
    if raw.get("url_has_query_params") or not raw.get("url_slug_has_hyphens"):
        tasks.append({
            "cat": "Structure", "check": "URL Structure", "status": "WARNING",
            "detail": f"Current URL is not written as a clean, semantic slug: {raw.get('url','')}",
            "fix": "Rewrite the URL path into a lowercase, hyphenated, keyword-rich slug with no query parameters.",
            "imp": 2,
        })
    return sorted(tasks, key=lambda x: -x["imp"])


def build_display_tasks(game_tasks):
    """Client-safe version of the task list: adds task_type/xp/quiz question
    (never the correct answer index) for the Virtual Web Console UI."""
    display = []
    for idx, t in enumerate(game_tasks):
        task_type = get_task_type(t)
        entry = {
            "task_index": idx,
            "cat": t["cat"], "check": t["check"], "status": t["status"],
            "detail": t["detail"], "fix": t["fix"], "imp": t["imp"],
            "task_type": task_type,
            "xp": xp_for_task(t["imp"]),
        }
        if task_type == "quiz":
            quiz = QUIZ_BANK.get(t["check"], QUIZ_BANK["_default"])
            entry["quiz"] = {"question": quiz["q"], "options": quiz["options"]}
        display.append(entry)
    return display


def validate_task_action(issue, payload):
    """Server-side Feedback step: validates the learner's submitted fix
    against the real issue. Returns (is_correct: bool, message: str)."""
    task_type = get_task_type(issue)

    if task_type == "meta_desc":
        val = (payload.get("value") or "").strip()
        n = len(val)
        if 120 <= n <= 160:
            return True, f"{n} characters — a well-sized meta description."
        return False, f"{n} characters — a meta description must be 120–160 characters."

    if task_type == "title":
        val = (payload.get("value") or "").strip()
        n = len(val)
        if 30 <= n <= 60:
            return True, f"{n} characters — a well-sized title tag."
        return False, f"{n} characters — a title tag must be 30–60 characters."

    if task_type == "url_slug":
        slug = (payload.get("value") or "").strip()
        is_valid = bool(re.fullmatch(r"/[a-z0-9]+(-[a-z0-9]+)*/?", slug)) and "?" not in slug
        if is_valid:
            return True, "Valid, clean semantic slug."
        return False, ("Slug must start with '/', use only lowercase letters/numbers "
                        "separated by hyphens, and contain no query parameters (?).")

    # quiz (Active Recall)
    quiz = QUIZ_BANK.get(issue["check"], QUIZ_BANK["_default"])
    choice = payload.get("choice_index")
    try:
        choice = int(choice)
    except (TypeError, ValueError):
        return False, "Select an answer before validating."
    if choice == quiz["correct"]:
        return True, "Correct!"
    return False, f"Not quite — {quiz['explain']}"


# =============================================================================
# ONE ENTRY POINT — everything a Django view needs, in one call
# =============================================================================
def run_full_audit(url):
    """Crawl -> score (rule-based categories + ML) -> detect issues ->
    build the dynamic gamification task set. Returns a single JSON dict."""
    raw = crawl_url(url)
    if raw.get("crawl_status") != "OK":
        return {"ok": False, "error": raw.get("crawl_status", "Unknown crawl error"), "url": url}

    cats, overall = compute_categories(raw)
    ml_score = ml_predict(raw)
    issues = get_issues(raw)

    if overall >= 75:
        grade = "A — Excellent"
    elif overall >= 55:
        grade = "B — Good"
    elif overall >= 35:
        grade = "C — Needs Work"
    else:
        grade = "D — Poor"

    max_xp = sum(xp_for_task(i["imp"]) for i in issues)

    # --- Dynamic gamification payload, built entirely from this audit's issues ---
    game_tasks = build_game_tasks(issues, raw)
    display_tasks = build_display_tasks(game_tasks)
    lvl_name, lvl_color, lvl_progress, lvl_next = get_level(0)

    game = {
        "tasks": display_tasks,
        "total_xp": 0,
        "max_xp": sum(xp_for_task(t["imp"]) for t in game_tasks),
        "completed_count": 0,
        "total_count": len(game_tasks),
        "level": {"name": lvl_name, "color": lvl_color, "progress": lvl_progress, "next_at": lvl_next},
        "badges": BADGES,
        "earned_badge_ids": [],
    }

    return {
        "ok": True,
        "url": url,
        "overall": overall,
        "ml_score": round(ml_score, 1),
        "grade": grade,
        "categories": cats,
        "issues": issues,
        "max_xp": max_xp,
        "errors_count": sum(1 for i in issues if i["status"] == "ERROR"),
        "warnings_count": sum(1 for i in issues if i["status"] == "WARNING"),
        "top_keywords": raw.get("top_keywords", []),
        "page_load_time_sec": raw.get("page_load_time_sec"),
        "word_count": raw.get("word_count", 0),
        "http_status_code": raw.get("http_status_code"),
        "game": game,
    }
