from django.contrib import admin

from .models import PontajEntry, PontajSheet


@admin.register(PontajSheet)
class PontajSheetAdmin(admin.ModelAdmin):
    list_display = ['department', 'year', 'month', 'status', 'generated_by', 'reviewed_by', 'updated_at']
    list_filter = ['status', 'department', 'year']
    readonly_fields = [f.name for f in PontajSheet._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(PontajEntry)
class PontajEntryAdmin(admin.ModelAdmin):
    list_display = ['sheet', 'user', 'day', 'hours', 'leave_code', 'is_edited']
    list_filter = ['is_edited', 'sheet__status']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    readonly_fields = [f.name for f in PontajEntry._meta.fields]

    def has_add_permission(self, request):
        return False
