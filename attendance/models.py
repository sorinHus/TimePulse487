from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal


class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('half_day', 'Half Day'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    date = models.DateField(default=timezone.now)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    notes = models.TextField(blank=True)
    work_hours = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Attendance (legacy)'
        verbose_name_plural = 'Attendances (legacy)'
        unique_together = ['user', 'date']
        ordering = ['-date']

    def __str__(self):
        return f'{self.user.username} - {self.date}'


class AttendanceSession(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('complete', 'Complete'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    date = models.DateField(default=timezone.localdate)
    clock_in = models.DateTimeField()
    clock_out = models.DateTimeField(null=True, blank=True)
    work_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    night_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Attendance Session'
        verbose_name_plural = 'Attendance Sessions'
        ordering = ['-date', '-clock_in']

    def __str__(self):
        return f'{self.user.username} - {self.date} - session {self.pk}'

    def calculate_hours(self):
        if not self.clock_in or not self.clock_out:
            return

        diff = self.clock_out - self.clock_in
        total_seconds = diff.total_seconds()
        self.work_hours = round(total_seconds / 3600, 2)

        night_seconds = 0
        current = self.clock_in
        while current < self.clock_out:
            next_tick = min(current + timedelta(minutes=1), self.clock_out)
            hour = current.hour
            if hour >= 22 or hour < 6:
                night_seconds += (next_tick - current).total_seconds()
            current = next_tick

        self.night_hours = round(night_seconds / 3600, 2)
        self.status = 'complete'
        self.save(update_fields=['work_hours', 'night_hours', 'status'])

    def get_overtime_hours(self):
        if not self.work_hours:
            return Decimal('0')
        total_day = AttendanceSession.objects.filter(
            user=self.user, date=self.date, status='complete'
        ).aggregate(total=models.Sum('work_hours'))['total'] or Decimal('0')
        overtime = total_day - Decimal('8.50')
        return max(overtime, Decimal('0'))


class OvertimeRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('partially_approved', 'Partially Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='overtime_requests'
    )
    date = models.DateField()
    requested_hours = models.DecimalField(max_digits=4, decimal_places=2)
    approved_hours = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='pending')
    manager_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='overtime_reviews'
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Overtime Request'
        verbose_name_plural = 'Overtime Requests'
        unique_together = ['user', 'date']
        ordering = ['-requested_at']

    def __str__(self):
        return f'{self.user.username} - {self.date} - {self.status}'


class ScheduleType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=60)
    pontaj_hours = models.DecimalField(
        max_digits=4, decimal_places=2, default=Decimal('8.00'),
        help_text='Ore fixe de pontaj/tichete de masă per zi lucrată, indiferent de orele reale.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Schedule Type'
        verbose_name_plural = 'Schedule Types'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.start_time}–{self.end_time})'

    @property
    def crosses_midnight(self):
        return self.end_time <= self.start_time


class Notification(models.Model):
    TYPE_CHOICES = [
        ('overtime', 'Overtime'),
        ('leave', 'Leave'),
        ('system', 'System'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')
    link = models.CharField(max_length=255, blank=True, default='')
    code = models.CharField(max_length=64, blank=True, default='')
    params = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} - {self.title}'