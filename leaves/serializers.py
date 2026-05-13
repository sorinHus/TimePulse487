from rest_framework import serializers
from .models import LeaveType, LeaveBalance, LeaveRequest, LeaveSchedule


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ['id', 'name', 'description', 'max_days_per_year', 'is_paid', 'color', 'is_active', 'is_sick_leave']


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color', read_only=True)
    remaining_days = serializers.ReadOnlyField()
    expires_at = serializers.SerializerMethodField()

    class Meta:
        model = LeaveBalance
        fields = [
            'id', 'leave_type', 'leave_type_name', 'leave_type_color',
            'year', 'total_days', 'used_days', 'expired_days', 'remaining_days', 'expires_at',
        ]

    def get_expires_at(self, obj):
        d = obj.expires_at
        return str(d) if d else None


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
        from datetime import date
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        if data['start_date'] < date.today():
            raise serializers.ValidationError({'start_date': 'Start date cannot be in the past.'})
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

def _carryover_data(user, year):
    try:
        prev = LeaveBalance.objects.get(user=user, leave_type__name='Annual Leave', year=year - 1)
        expires = prev.expires_at
        return float(prev.remaining_days), str(expires) if expires else None
    except LeaveBalance.DoesNotExist:
        return 0, None


class LeaveScheduleSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    annual_leave_days = serializers.SerializerMethodField()
    carryover_days = serializers.SerializerMethodField()
    carryover_expires_at = serializers.SerializerMethodField()

    class Meta:
        model = LeaveSchedule
        fields = [
            'id', 'user', 'username', 'full_name', 'year', 'status',
            'monthly_plan', 'total_planned_days',
            'annual_leave_days', 'carryover_days', 'carryover_expires_at',
            'review_note', 'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'status', 'total_planned_days',
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.get_full_name() if obj.reviewed_by else None

    def get_annual_leave_days(self, obj):
        from .views import get_annual_leave_days_for_year
        return get_annual_leave_days_for_year(obj.user, obj.year)

    def get_carryover_days(self, obj):
        days, _ = _carryover_data(obj.user, obj.year)
        return days

    def get_carryover_expires_at(self, obj):
        _, expires = _carryover_data(obj.user, obj.year)
        return expires


class SeniorityRuleSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import SeniorityRule
        model = SeniorityRule
        fields = ['id', 'min_years', 'extra_days', 'created_at']
        read_only_fields = ['id', 'created_at']        