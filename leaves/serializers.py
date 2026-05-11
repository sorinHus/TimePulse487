from rest_framework import serializers
from .models import LeaveType, LeaveBalance, LeaveRequest


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ['id', 'name', 'description', 'max_days_per_year', 'is_paid', 'color', 'is_active', 'is_sick_leave']


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color', read_only=True)
    remaining_days = serializers.ReadOnlyField()

    class Meta:
        model = LeaveBalance
        fields = ['id', 'leave_type', 'leave_type_name', 'leave_type_color', 'year', 'total_days', 'used_days', 'remaining_days']


class LeaveRequestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)
    substitute_name = serializers.CharField(source='substitute.get_full_name', read_only=True, default=None)
    registered_by_name = serializers.CharField(source='registered_by.get_full_name', read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'user', 'username', 'full_name',
            'leave_type', 'leave_type_name', 'leave_type_color',
            'start_date', 'end_date', 'total_days', 'reason',
            'substitute', 'substitute_name',
            'status', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'review_note',
            'medical_document', 'registered_by', 'registered_by_name',
            'overlap_action',
            'created_at'
        ]
        read_only_fields = ['id', 'user', 'total_days', 'status', 'reviewed_by', 'reviewed_at', 'created_at']

    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return data


class SickLeaveRegisterSerializer(serializers.Serializer):
    """Serializator pentru înregistrarea concediului medical de către manager."""
    user_id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    medical_document = serializers.CharField(max_length=500, required=False, allow_blank=True)
    overlap_action = serializers.ChoiceField(choices=['return', 'extend'], default='return')

    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return data