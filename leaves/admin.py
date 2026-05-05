from django.contrib import admin
from .models import LeaveType, LeaveBalance, LeaveRequest


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'max_days_per_year', 'is_paid', 'is_active']
    list_filter = ['is_paid', 'is_active']


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'leave_type', 'year', 'total_days', 'used_days']
    list_filter = ['year', 'leave_type']
    search_fields = ['user__username']


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'leave_type', 'start_date', 'end_date', 'total_days', 'status']
    list_filter = ['status', 'leave_type']
    search_fields = ['user__username']