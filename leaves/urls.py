from django.urls import path
from .views import (
    LeaveTypeListView, LeaveBalanceView,
    LeaveRequestListCreateView, LeaveRequestDetailView,
    LeaveApproveRejectView
)

urlpatterns = [
    path('leaves/types/', LeaveTypeListView.as_view(), name='leave_types'),
    path('leaves/balance/', LeaveBalanceView.as_view(), name='leave_balance'),
    path('leaves/requests/', LeaveRequestListCreateView.as_view(), name='leave_requests'),
    path('leaves/requests/<int:pk>/', LeaveRequestDetailView.as_view(), name='leave_request_detail'),
    path('leaves/requests/<int:pk>/<str:action>/', LeaveApproveRejectView.as_view(), name='leave_approve_reject'),
]