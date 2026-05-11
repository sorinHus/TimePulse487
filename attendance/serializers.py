from rest_framework import serializers
from django.utils import timezone
from .models import Attendance, AttendanceSession


class AttendanceSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'user', 'username', 'full_name', 'date',
            'check_in', 'check_out', 'status', 'notes',
            'work_hours', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'work_hours', 'created_at']


class CheckInSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)


class CheckOutSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)


class AttendanceSessionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    clock_in_display = serializers.SerializerMethodField()
    clock_out_display = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'user', 'username', 'full_name', 'date',
            'clock_in', 'clock_out', 'clock_in_display', 'clock_out_display',
            'work_hours', 'night_hours', 'notes', 'status', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'work_hours', 'night_hours', 'status', 'created_at']

    def get_clock_in_display(self, obj):
        if obj.clock_in:
            local = timezone.localtime(obj.clock_in)
            return local.strftime('%H:%M')
        return None

    def get_clock_out_display(self, obj):
        if obj.clock_out:
            local = timezone.localtime(obj.clock_out)
            return local.strftime('%H:%M')
        return None


class DaySummarySerializer(serializers.Serializer):
    date = serializers.DateField()
    day_of_week = serializers.CharField()
    sessions = AttendanceSessionSerializer(many=True)
    total_hours = serializers.DecimalField(max_digits=5, decimal_places=2)
    total_night_hours = serializers.DecimalField(max_digits=5, decimal_places=2)
    complete_sessions = serializers.IntegerField()
    open_sessions = serializers.IntegerField()
    has_open_session = serializers.BooleanField()
    status = serializers.CharField()
    remaining_hours = serializers.DecimalField(max_digits=5, decimal_places=2)
    overtime_hours = serializers.DecimalField(max_digits=5, decimal_places=2)


class ClockInSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)


class ClockOutSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)