import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { login, logout, getMe } from '../api/auth'
import { clockIn, getTodaySessions } from '../api/attendance'
import {
  getLeaveBalance, getLeaveTypes, createLeaveRequest,
  getLeaveRequests, getWorkingDays,
} from '../api/leaves'
import { dateLocale, translateLeaveType } from '../i18n/config'
import s from './MobileApp.module.css'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtH(dec) {
  if (dec === null || dec === undefined || dec === '') return '--'
  const n = parseFloat(dec)
  if (isNaN(n)) return '--'
  return `${Math.floor(n)}h ${Math.round((n - Math.floor(n)) * 60)}m`
}

function todayLabel(locale) {
  return new Date().toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

/* ════════════════════════════════════════════════════════════
   LOGIN
════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)

  const handle = async () => {
    setErr(''); setLoading(true)
    try {
      const user = await login(username, password)
      onLogin(user)
    } catch {
      setErr(t('mobileApp.invalidCredentials'))
    }
    setLoading(false)
  }

  return (
    <div className={s.loginWrap}>
      <div className={s.loginLogo}>
        <img src="/favicon.svg" alt="HCM487" width="48" height="48" />
        <span>HCM487</span>
      </div>
      <div className={s.loginCard}>
        <div className={s.loginTitle}>{t('mobileApp.signIn')}</div>
        <input
          className={s.input} type="text" placeholder={t('mobileApp.username')}
          value={username} onChange={e => setUsername(e.target.value)}
          autoCapitalize="none" autoCorrect="off"
        />
        <input
          className={s.input} type="password" placeholder={t('mobileApp.password')}
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
        />
        {err && <div className={s.loginErr}>{err}</div>}
        <button className={`${s.bigBtn} ${s.btnIn}`} onClick={handle} disabled={loading}>
          {loading ? t('mobileApp.signingIn') : t('mobileApp.signIn')}
        </button>
      </div>
      <div className={s.installHint}>
        {t('mobileApp.installHintAndroid')}<br />
        {t('mobileApp.installHintIos')}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   CLOCK TAB
════════════════════════════════════════════════════════════ */
function ClockTab() {
  const { t, i18n } = useTranslation()
  const locale = dateLocale(i18n.language)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  const load = () => {
    getTodaySessions()
      .then(setSummary)
      .catch(() => setSummary(null))
  }

  useEffect(() => { load() }, [])

  const handleIn = async () => {
    setErr(''); setLoading(true)
    try { await clockIn(); load() }
    catch (e) { setErr(e?.response?.data?.detail || t('mobileApp.clockInFailed')) }
    setLoading(false)
  }

  const onLeave    = summary?.on_leave ?? null
  const hasOpen    = summary?.has_open_session
  const isComplete = summary?.status === 'complete'
  const openSess   = summary?.sessions?.find(x => x.status === 'open')
  const lastOut    = [...(summary?.sessions ?? [])].reverse().find(x => x.clock_out)

  return (
    <div className={s.tab}>
      <div className={s.dateLabel}>{todayLabel(locale)}</div>

      {onLeave && (
        <div className={s.leaveBanner}>
          {t('mobileApp.onLeave')} <strong>{translateLeaveType(t, onLeave.leave_type)}</strong> · {onLeave.start_date} → {onLeave.end_date}
        </div>
      )}

      <div className={`${s.clockCard} ${hasOpen ? s.clockCardActive : isComplete ? s.clockCardDone : ''}`}>
        <div className={s.clockStatus}>
          <span className={`${s.pulse} ${hasOpen ? s.pulseOn : ''}`} />
          {isComplete
            ? t('mobileApp.shiftComplete')
            : hasOpen
            ? t('mobileApp.currentlyWorking')
            : onLeave
            ? t('mobileApp.onLeave')
            : t('mobileApp.notClockedIn')}
        </div>
        <div className={s.clockTimes}>
          <div className={s.clockTimeBlock}>
            <span className={s.clockTimeLabel}>{t('mobileApp.in')}</span>
            <span className={s.clockTimeValue}>{fmt(openSess?.clock_in ?? summary?.sessions?.[0]?.clock_in)}</span>
          </div>
          <div className={s.clockTimeSep} />
          <div className={s.clockTimeBlock}>
            <span className={s.clockTimeLabel}>{t('mobileApp.out')}</span>
            <span className={s.clockTimeValue}>{hasOpen ? '--:--' : fmt(lastOut?.clock_out)}</span>
          </div>
          <div className={s.clockTimeSep} />
          <div className={s.clockTimeBlock}>
            <span className={s.clockTimeLabel}>{t('mobileApp.total')}</span>
            <span className={s.clockTimeValue}>{fmtH(summary?.total_hours)}</span>
          </div>
        </div>
      </div>

      {err && <div className={s.errMsg}>{err}</div>}

      {!hasOpen && !isComplete && !onLeave && (
        <button className={`${s.bigBtn} ${s.btnIn}`} onClick={handleIn} disabled={loading}>
          {loading ? '…' : t('mobileApp.clockIn')}
        </button>
      )}
      {isComplete && <div className={s.doneMsg}>{t('mobileApp.doneForToday')}</div>}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   LEAVE TAB
════════════════════════════════════════════════════════════ */
function LeaveTab() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  const [balances, setBalances]   = useState([])
  const [types, setTypes]         = useState([])
  const [requests, setRequests]   = useState([])
  const [form, setForm]           = useState({ leave_type: '', start_date: '', end_date: '', reason: '' })
  const [workDays, setWorkDays]   = useState(null)
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [err, setErr]             = useState('')
  const [ok, setOk]               = useState('')

  const load = () => {
    getLeaveBalance(year).then(setBalances).catch(() => setBalances([]))
    getLeaveTypes().then(setTypes).catch(() => setTypes([]))
    getLeaveRequests()
      .then(r => {
        const list = Array.isArray(r) ? r : r.results ?? []
        setRequests(list.filter(x => x.status === 'pending' || x.status === 'approved'))
      })
      .catch(() => setRequests([]))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (form.start_date && form.end_date && form.start_date <= form.end_date) {
      getWorkingDays(form.start_date, form.end_date)
        .then(d => setWorkDays(d.working_days ?? null))
        .catch(() => setWorkDays(null))
    } else {
      setWorkDays(null)
    }
  }, [form.start_date, form.end_date])

  const handleSubmit = async () => {
    if (!form.leave_type || !form.start_date || !form.end_date) {
      setErr(t('mobileApp.allFieldsRequired')); return
    }
    setSaving(true); setErr('')
    try {
      await createLeaveRequest({
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date:   form.end_date,
        reason:     form.reason,
      })
      setOk(t('mobileApp.requestSubmitted'))
      setShowForm(false)
      setForm({ leave_type: '', start_date: '', end_date: '', reason: '' })
      load()
      setTimeout(() => setOk(''), 3000)
    } catch (e) {
      setErr(e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? t('mobileApp.requestFailed'))
    }
    setSaving(false)
  }

  return (
    <div className={s.tab}>
      {/* Balance cards */}
      <div className={s.balanceRow}>
        {balances.map(b => (
          <div key={b.id} className={s.balanceCard}>
            <div className={s.balanceName}>{translateLeaveType(t, b.leave_type_name)}</div>
            <div className={s.balanceNum}>{b.remaining_days ?? '--'}</div>
            <div className={s.balanceSub}>{t('mobileApp.daysLeft')}</div>
          </div>
        ))}
      </div>

      {ok && <div className={s.okMsg}>{ok}</div>}

      {!showForm && (
        <button className={`${s.bigBtn} ${s.btnIn}`} onClick={() => setShowForm(true)}>
          {t('mobileApp.newLeaveRequest')}
        </button>
      )}

      {showForm && (
        <div className={s.formCard}>
          <div className={s.formTitle}>{t('mobileApp.newLeaveRequestTitle')}</div>

          <label className={s.formLabel}>{t('mobileApp.type')}</label>
          <select className={s.input} value={form.leave_type}
            onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}>
            <option value="">{t('mobileApp.selectType')}</option>
            {types.map(lt => <option key={lt.id} value={lt.id}>{translateLeaveType(t, lt.name)}</option>)}
          </select>

          <label className={s.formLabel}>{t('mobileApp.startDate')}</label>
          <input className={s.input} type="date" value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />

          <label className={s.formLabel}>{t('mobileApp.endDate')}</label>
          <input className={s.input} type="date" value={form.end_date}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />

          {workDays !== null && (
            <div className={s.workDaysInfo}>
              {workDays} {workDays === 1 ? t('common.workingDay') : t('common.workingDays')}
            </div>
          )}

          <label className={s.formLabel}>{t('mobileApp.reasonOptional')}</label>
          <textarea className={s.input} rows={2} value={form.reason}
            placeholder={t('mobileApp.reasonPlaceholder')}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />

          {err && <div className={s.errMsg}>{err}</div>}

          <div className={s.formBtns}>
            <button className={s.cancelBtn} onClick={() => { setShowForm(false); setErr('') }}>
              {t('mobileApp.cancel')}
            </button>
            <button className={`${s.bigBtn} ${s.btnIn}`} onClick={handleSubmit} disabled={saving}>
              {saving ? '…' : t('mobileApp.submit')}
            </button>
          </div>
        </div>
      )}

      {/* My requests */}
      {requests.length > 0 && (
        <div className={s.requestsList}>
          <div className={s.listTitle}>{t('mobileApp.myRequests')}</div>
          {requests.map(r => (
            <div key={r.id} className={s.requestCard}>
              <div className={s.requestTop}>
                <span className={s.requestType}>{translateLeaveType(t, r.leave_type_name)}</span>
                <span className={`${s.reqBadge} ${
                  r.status === 'approved' ? s.reqBadgeGreen :
                  r.status === 'rejected' ? s.reqBadgeRed :
                  s.reqBadgeAmber
                }`}>
                  {t(`common.status.${r.status}`)}
                </span>
              </div>
              <div className={s.requestDates}>
                {r.start_date} → {r.end_date}
                {r.total_days != null ? ` · ${r.total_days} ${r.total_days === 1 ? t('common.day') : t('common.days')}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function MobileApp() {
  const { t } = useTranslation()
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('clock')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      getMe().then(setUser).catch(() => {}).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogout = async () => {
    try { await logout() } catch {}
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        {t('common.loading')}
      </div>
    )
  }

  if (!user) return <LoginScreen onLogin={setUser} />

  const name = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.username

  return (
    <div className={s.container}>
      <div className={s.header}>
        <div className={s.headerBrand}>
          <img src="/favicon.svg" alt="HCM487" width="26" height="26" />
          <div>
            <div className={s.headerTitle}>HCM487</div>
            <div className={s.headerSub}>{name}</div>
          </div>
        </div>
        <button className={s.logoutBtn} onClick={handleLogout}>{t('mobileApp.signOut')}</button>
      </div>

      <div className={s.content}>
        {tab === 'clock' && <ClockTab />}
        {tab === 'leave' && <LeaveTab />}
      </div>

      <div className={s.tabBar}>
        <button
          className={`${s.tabBtn} ${tab === 'clock' ? s.tabBtnActive : ''}`}
          onClick={() => setTab('clock')}
        >
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t('mobileApp.tabClock')}</span>
        </button>
        <button
          className={`${s.tabBtn} ${tab === 'leave' ? s.tabBtnActive : ''}`}
          onClick={() => setTab('leave')}
        >
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>{t('mobileApp.tabLeave')}</span>
        </button>
      </div>
    </div>
  )
}
