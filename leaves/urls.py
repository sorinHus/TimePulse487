from django.urls import path
from .views import (
    LeaveTypeListView, LeaveBalanceView,
    LeaveRequestListCreateView, LeaveRequestDetailView,
    LeaveApproveRejectView, WorkingDaysPreviewView,
    SickLeaveRegisterView,
)

urlpatterns = [
    path('leaves/types/', LeaveTypeListView.as_view(), name='leave_types'),
    path('leaves/balance/', LeaveBalanceView.as_view(), name='leave_balance'),
    path('leaves/requests/', LeaveRequestListCreateView.as_view(), name='leave_requests'),
    path('leaves/requests/<int:pk>/', LeaveRequestDetailView.as_view(), name='leave_request_detail'),
    path('leaves/requests/<int:pk>/<str:action>/', LeaveApproveRejectView.as_view(), name='leave_approve_reject'),
    path('leaves/working-days/', WorkingDaysPreviewView.as_view(), name='working_days_preview'),
    path('leaves/sick-leave/register/', SickLeaveRegisterView.as_view(), name='sick_leave_register'),
]