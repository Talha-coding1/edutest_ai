<div align="center">

# 🎓 EduTest AI
### AI-Powered SEO Learning Platform with Real-Time Auditing & Gamification

[![Python](https://img.shields.io/badge/Python-3.10-blue?style=flat-square&logo=python)](https://python.org)
[![Django](https://img.shields.io/badge/Django-4.2-green?style=flat-square&logo=django)](https://djangoproject.com)
[![XGBoost](https://img.shields.io/badge/XGBoost-R²%3D0.9829-orange?style=flat-square)](https://xgboost.ai)
[![Groq Cloud](https://img.shields.io/badge/LLM-Groq%20Cloud-purple?style=flat-square)](https://console.groq.com)
[![License](https://img.shields.io/badge/License-MIT-brightgreen?style=flat-square)](LICENSE)

**Developed by Muhammad Talha — AI Engineer Intern**  
Crown Software House & Computer Institute | Mingora, Swat

---

[Overview](#-comprehensive-project-overview) • [Key Features](#-key-features--capability-matrix) • [Tech Stack](#%EF%B8%8F-technology-stack) • [Setup Guide](#-installation--local-development-guide) • [Architecture](#-repository-structure) • [ML Benchmarks](#-machine-learning-benchmarks)

</div>

---

## 📌 Comprehensive Project Overview

**EduTest AI** is an advanced full-stack platform engineered to revolutionize search engine optimization (SEO) education. By combining real-time web scraping, machine learning predictive scoring, and gamification mechanics, the system bridges the gap between theoretical SEO concepts and practical execution.

Instead of reading passive documentation, users engage directly with an interactive **Virtual Web Console** to:
1. **Audit Live Websites:** Input any live URL to extract 28 structural on-page features and generate an objective ML-driven SEO health score.
2. **Execute Interactive Fixes:** Resolve detected page defects (e.g., missing meta tags, weak heading hierarchy, missing alt attributes) through guided terminal-style tasks.
3. **Gamified Skill Progression:** Earn XP, unlock achievement badges, maintain streaks, and level up across user ranks as optimization proficiency improves.
4. **Contextual AI Assistance:** Interact with an integrated LLM tutor powered by the Groq Cloud API for instant technical guidance on SEO best practices and software quality assurance.

---

## ✨ Key Features & Capability Matrix

| Feature Module | Technical Specification | Functional Scope |
| :--- | :--- | :--- |
| 🔍 **Real-Time Web Scraper** | BeautifulSoup4 & Requests | Crawls external URLs in real-time, extracting 28 structural metadata signals, heading hierarchies, open graph tags, image alt attributes, and link distributions. |
| 🤖 **Predictive ML Engine** | XGBoost Regressor ($R^2 = 0.9829$, MAE = 0.25) | Pre-trained on 500+ crawled web pages to output an accurate 0–100 SEO health score. |
| 🎮 **Gamified Virtual Console** | Interactive JS Terminal & Task Parser | Dynamically generates interactive tasks based on specific page failures and validates user input in real-time. |
| 🧠 **AI LLM Tutor** | Groq Cloud API (`llama-3.1-8b-instant`) | Provides contextual assistance, explaining complex technical SEO concepts and software testing principles with zero local hardware overhead. |
| 📊 **Interactive Analytics** | Chart.js Data Visualization | Renders dynamic trend charts tracking score progress over time, radar breakdowns across technical categories, and badge progression vaults. |
| 📝 **Multi-Level Quiz Engine** | Categorized Assessment Engine | Features 12+ structured quizzes split across Beginner, Intermediate, and Advanced tiers with automated scoring and feedback. |
| 👤 **User Profile System** | Dynamic Gamification Profiles | Persists user state, XP totals, current rank, earned achievement badges, and individual site audit histories. |
| 🛡️ **Administrative Suite** | Custom Django Admin Interface | Comprehensive administrative controls over user activity, audit logging, model performance review, and platform content management. |

---

## 🛠️ Technology Stack

### **Backend & Core Architecture**
* **Language:** Python 3.10
* **Framework:** Django 4.2 LTS
* **Environment Management:** `python-dotenv`
* **Data Transport & HTTP:** `requests`, `urllib3`

### **Machine Learning & Data Processing**
* **Model Architecture:** XGBoost Regressor
* **Preprocessing & Feature Scaling:** Scikit-Learn (`StandardScaler`)
* **Data Manipulation & Analysis:** NumPy, Pandas
* **Model Serialization:** `joblib` / `pickle`

### **Artificial Intelligence & LLMs**
* **Provider:** Groq Cloud Platform (Free Tier, Hosted)
* **Default Model:** `llama-3.1-8b-instant`
* **Integration Strategy:** Official `groq` Python SDK with automated fallback to direct REST API calls via `requests`

### **Frontend & User Interface**
* **Core Technologies:** HTML5, CSS3 (Custom Variables, Flexbox/Grid), JavaScript (ES6+)
* **Data Visualization:** Chart.js
* **UI Theme:** Custom dark-theme interactive web console

---

## 🚀 Installation Guide

Follow the following step to clone the project on your local machine.

### 1. Clone the Repository

git clone [https://github.com/Talha-coding1/edutest_ai.git](https://github.com/Talha-coding1/edutest_ai.git)

---

### 👨‍💻 Developer & Internship Information

* **Developer:** Muhammad Talha
* **Role:** AI Engineer Intern
* **Supervisor / Trainer:** Mr. Said Rahman sb
* **Email:** saidrahman@gmail.com
* **Organization:** Crown Software House & Computer Institute
* **Location:** Mingora, Swat, Khyber Pakhtunkhwa, Pakistan
* **GitHub Profile:** [@Talha-coding1](https://github.com/Talha-coding1)

---

### 📄 License & Usage

This software is developed and maintained for professional portfolio demonstration, software engineering evaluation, and instructional technology implementation under **Crown Software House & Computer Institute**.
