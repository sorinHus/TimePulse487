from collections import defaultdict

from rest_framework import serializers

from .models import PontajSheet


class PontajSheetSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    generated_by_name = serializers.CharField(source='generated_by.get_full_name', read_only=True, default=None)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, default=None)
    num_days = serializers.SerializerMethodField()
    holidays = serializers.SerializerMethodField()
    rows = serializers.SerializerMethodField()

    class Meta:
        model = PontajSheet
        fields = [
            'id', 'department', 'department_name', 'user', 'owner_name', 'year', 'month', 'status',
            'generated_by_name', 'generated_at', 'reviewed_by_name', 'reviewed_at',
            'rejection_note', 'num_days', 'holidays', 'rows',
        ]

    def get_department_name(self, obj):
        return obj.department.name if obj.department_id else None

    def get_owner_name(self, obj):
        return obj.user.get_full_name() if obj.user_id else None

    def get_num_days(self, obj):
        import calendar
        return calendar.monthrange(obj.year, obj.month)[1]

    def get_holidays(self, obj):
        from leaves.utils import get_public_holidays_named
        holidays = get_public_holidays_named(obj.year)
        return {d.day: name for d, name in holidays.items() if d.month == obj.month}

    def get_rows(self, obj):
        entries = obj.entries.select_related('user').order_by(
            'user__last_name', 'user__first_name', 'day'
        )
        by_user = defaultdict(lambda: {'user_id': None, 'full_name': '', 'position': '', 'employee_number': None, 'cells': []})
        for entry in entries:
            bucket = by_user[entry.user_id]
            bucket['user_id'] = entry.user_id
            bucket['full_name'] = entry.user.get_full_name() or entry.user.username
            bucket['position'] = entry.user.position
            bucket['employee_number'] = entry.user.employee_number
            bucket['cells'].append({
                'entry_id': entry.id,
                'day': entry.day,
                'hours': float(entry.hours) if entry.hours is not None else None,
                'leave_code': entry.leave_code,
                'is_edited': entry.is_edited,
                'leave_from_request': entry.leave_from_request,
            })
        return list(by_user.values())
