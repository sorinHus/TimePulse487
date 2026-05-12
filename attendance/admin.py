from django.contrib import admin
from .models import Attendance, AttendanceSession


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'check_in', 'check_out', 'work_hours', 'status']
    list_filter = ['status', 'date']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'clock_in', 'clock_out', 'work_hours', 'status']
    list_filter = ['status', 'date']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    ordering = ['-date', '-clock_in']