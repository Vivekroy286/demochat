from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login' ),
    path('dashboard/',views.dashboard, name='dashboard'),
    path('',views.index, name='index'),
    path('logout/',views.logout_view, name='logout'),
    path('join/',views.join_room, name='join_room'),
    path('meeting/',views.videocall, name='meeting'),
    
    # Add more URL patterns as needed
]