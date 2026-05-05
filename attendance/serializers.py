from rest_framework import serializers
from django.utils import timezone
from .models import Attendance


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