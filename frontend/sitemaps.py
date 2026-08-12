"""
sitemaps.py
=================================================================
Defines what goes into /sitemap.xml.

Only genuinely public, crawlable pages belong here. Everything else in
this app (dashboard, chatbot, quiz, profile, analysis, admin-panel,
game console, ...) sits behind @login_required, so a search engine
would just hit a login redirect if it tried to index them — including
them in the sitemap would create crawl errors, not extra visibility.

If a page's @login_required decorator in views.py is ever removed
(i.e. it becomes public), add its url name to `public_pages` below.
Nothing else needs to change — priority/changefreq/lastmod are all
computed automatically.
"""
from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class StaticViewSitemap(Sitemap):
    # protocol left unset on purpose: Django auto-detects it from the
    # incoming request (http on localhost, https in production) —
    # hardcoding 'https' here would make http://127.0.0.1:8000/sitemap.xml
    # list broken https links while testing locally.

    # url name -> (changefreq, priority)
    public_pages = {
        'home': ('weekly', 1.0),
        'signup': ('monthly', 0.5),
        'login': ('monthly', 0.3),
    }

    def items(self):
        return list(self.public_pages.keys())

    def location(self, item):
        return reverse(item)

    def changefreq(self, item):
        return self.public_pages[item][0]

    def priority(self, item):
        return self.public_pages[item][1]
