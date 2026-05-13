from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone


class LeaveType(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    max_days_per_year = models.PositiveIntegerField(default=21)
    is_paid = models.BooleanField(default=True)
    color = models.CharField(max_length=7, default='#3B82F6')
    is_active = models.BooleanField(default=True)
    is_sick_leave = models.BooleanField(default=False)  # B10: marchează Sick Leave

    class Meta:
        verbose_name = 'Leave Type'
        verbose_name_plural = 'Leave Types'

    def __str__(self):
        return self.name


class LeaveBalance(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='leave_balances'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='balances'
    )
    year = models.PositiveIntegerField(default=timezone.now().year)
    total_days = models.PositiveIntegerField(default=21)
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    expired_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    class Meta:
        verbose_name = 'Leave Balance'
        verbose_name_plural = 'Leave Balances'
        unique_together = ['user', 'leave_type', 'year']

    def __str__(self):
        return f'{self.user.username} - {self.leave_type.name} ({self.year})'

    @property
    def remaining_days(self):
        return max(Decimal('0'), self.total_days - self.used_days - self.expired_days)

    @property
    def expires_at(self):
        """Annual Leave expires on July 1 of year+2 (18 months after Dec 31 of year)."""
        if self.leave_type.name == 'Annual Leave':
            from datetime import date
            return date(self.year + 2, 7, 1)
        return None


class LeaveRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    OVERLAP_ACTION_CHOICES = [
        ('return', 'Return days to balance'),
        ('extend', 'Extend leave after sick leave'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='requests'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    reason = models.TextField(blank=True)
    substitute = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='substitute_for',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_leaves'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)

    # B10: câmpuri pentru concediu medical
    medical_document = models.CharField(max_length=500, blank=True, default='')  # URL/nume fișier, opțional
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registered_sick_leaves'
    )  # managerul care a înregistrat CM

    # B13: acțiunea la suprapunere
    overlap_action = models.CharField(
        max_length=10,
        choices=OVERLAP_ACTION_CHOICES,
        default='return',
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Leave Request'
        verbose_name_plural = 'Leave Requests'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} - {self.leave_type.name} ({self.start_date} - {self.end_date})'

    def calculate_days(self):
        from .utils import count_working_days
        days = count_working_days(self.start_date, self.end_date)
        self.total_days = days
        self.save(update_fields=['total_days'])
        return days

class SeniorityRule(models.Model):
    """Reguli zile extra concediu după vechime — configurabile de admin."""
    min_years = models.PositiveIntegerField(
        unique=True,
        help_text='Număr minim de ani de vechime'
    )
    extra_days = models.PositiveIntegerField(
        help_text='Zile extra de concediu de odihnă'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Seniority Rule'
        verbose_name_plural = 'Seniority Rules'
        ordering = ['min_years']

    def __str__(self):
        return f'{self.min_years}+ years → +{self.extra_days} days'        