from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, MeView, ChangePasswordView, LogoutView, UserListView, UserDetailView, DepartmentListView, ColleaguesListView, DeactivateUserView, ActivateUserView

urlpatterns = [
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('users/<int:pk>/deactivate/', DeactivateUserView.as_view(), name='user_deactivate'),
    path('users/<int:pk>/activate/', ActivateUserView.as_view(), name='user_activate'),
    path('departments/', DepartmentListView.as_view(), name='department_list'),
    path('users/colleagues/', ColleaguesListView.as_view(), name='colleagues_list'),
]