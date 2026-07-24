from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Department

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    schedule_type_name = serializers.CharField(source='schedule_type.name', read_only=True, default=None)

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'schedule_type', 'schedule_type_name']


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    full_name = serializers.SerializerMethodField()
    effective_role = serializers.SerializerMethodField()
    is_substituting = serializers.SerializerMethodField()
    substituting_for_name = serializers.SerializerMethodField()
    schedule_type_name = serializers.CharField(source='schedule_type.name', read_only=True, default=None)
    effective_schedule_type_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'role', 'effective_role', 'department', 'department_name',
            'phone', 'position', 'employee_number', 'hire_date', 'avatar', 'is_active', 'deactivation_reason',
            'temporary_role', 'temporary_role_start', 'temporary_role_end',
            'is_substituting', 'substituting_for', 'substituting_for_name',
            'schedule_type', 'schedule_type_name', 'effective_schedule_type_name',
        ]
        read_only_fields = ['id', 'effective_role', 'is_substituting', 'substituting_for_name']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_effective_role(self, obj):
        return obj.effective_role

    def get_is_substituting(self, obj):
        return obj.is_substituting

    def get_substituting_for_name(self, obj):
        if obj.substituting_for:
            return obj.substituting_for.get_full_name()
        return None

    def get_effective_schedule_type_name(self, obj):
        schedule = obj.effective_schedule_type
        return schedule.name if schedule else None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password2', 'role', 'department', 'position', 'employee_number']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password2']:
            raise serializers.ValidationError({'new_password': 'Passwords do not match.'})
        return data