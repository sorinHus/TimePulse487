from django.contrib import admin

# Register your models here.
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from attendance.models import ScheduleType
from .models import User, Department


@admin.register(ScheduleType)
class ScheduleTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_time', 'end_time', 'break_minutes', 'pontaj_hours']
    search_fields = ['name']


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'schedule_type', 'description', 'created_at']
    list_filter = ['schedule_type']
    search_fields = ['name']


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'get_full_name', 'role', 'position', 'employee_number', 'department', 'is_active']
    list_filter = ['role', 'department', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'email', 'employee_number']
    fieldsets = UserAdmin.fieldsets + (
        ('Info suplimentară', {
            'fields': ('role', 'department', 'manager', 'phone', 'position', 'employee_number', 'hire_date', 'avatar')
        }),
    )