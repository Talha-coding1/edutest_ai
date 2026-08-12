from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),

    # Auth
    path('signup/', views.signup, name='signup'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Core pages (login required)
    path('chatbot/', views.chatbot, name='chatbot'),
    path('chatbot/thread/new/', views.chat_new_thread, name='chat_new_thread'),
    path('chatbot/thread/<int:thread_id>/messages/', views.chat_thread_messages, name='chat_thread_messages'),
    path('chatbot/thread/<int:thread_id>/message/', views.chat_send_message, name='chat_send_message'),
    path('chatbot/thread/<int:thread_id>/delete/', views.chat_delete_thread, name='chat_delete_thread'),
    path('chatbot/thread/<int:thread_id>/export/', views.chat_export_thread, name='chat_export_thread'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('quiz/', views.quiz, name='quiz'),
    path('quiz/<str:quiz_id>/questions/', views.quiz_questions, name='quiz_questions'),
    path('quiz/question/<int:question_id>/check/', views.quiz_check_answer, name='quiz_check_answer'),
    path('quiz/complete/', views.complete_quiz, name='complete_quiz'),
    path('profile/', views.profile, name='profile'),
    path('profile/preferences/', views.update_preferences, name='update_preferences'),

    # Admin Dashboard (staff/superuser only)
    path('admin-panel/', views.admin_dashboard, name='admin_dashboard'),
    path('admin-panel/user/<int:user_id>/', views.admin_user_detail, name='admin_user_detail'),

    # Website Analyzer
    path('analysis/', views.analysis, name='analysis'),
    path('analysis/run/', views.analyze_url, name='analyze_url'),

    # Game Console — per-audit-record persistent gamification
    path('analysis/console/', views.game_console_latest, name='game_console_latest'),
    path('analysis/console/<int:record_id>/', views.game_console, name='game_console'),
    path('analysis/game/<int:record_id>/validate/', views.validate_task, name='validate_task'),
    path('analysis/game/<int:record_id>/undo/', views.undo_task, name='undo_task'),
    path('analysis/game/<int:record_id>/reset/', views.reset_game, name='reset_game'),
]
