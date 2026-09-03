import { useState, useEffect, useCallback } from 'react'
import ConsentModal from './ConsentModal'
import { checkRegNo, saveStudent } from '../lib/db'

// Institution email domain regex — validates standard university email addresses
const EMAIL_DOMAIN_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const SECTIONS = ['A', 'B', 'C', 'D']
const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'MECH', 'CIVIL']

const INITIAL_FORM = { name: '', regNo: '', dept: 'IT', section: '', email: '' }
const INITIAL_ERRORS = { name: '', regNo: '', dept: '', section: '', email: '' }

function validateField(field, value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  switch (field) {
    case 'name':
      if (!trimmed) return 'Full student name is required'
      if (!/^[a-zA-Z\s.'-]{2,60}$/.test(trimmed)) return 'Letters and spaces only (2–60 chars)'
      return ''
    case 'regNo':
      if (!trimmed) return 'Registration number is required'
      if (!/^[A-Za-z0-9]{4,20}$/.test(trimmed)) return 'Alphanumeric format (4–20 chars, e.g. 21IT001)'
      return ''
    case 'section':
      if (!value) return 'Please assign an academic section'
      return ''
    case 'email':
      if (!trimmed) return 'College email address is required'
      if (!EMAIL_DOMAIN_REGEX.test(trimmed)) return 'Enter a valid institutional email (e.g. name@college.edu)'
      return ''
    default:
      return ''
  }
}

function FormField({ id, label, required, error, hint, children }) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {label} {required && <span style={{ color: 'var(--accent-hover)', fontWeight: 700 }}>*</span>}
        </span>
      </label>
      {children}
      {error && (
        <div className="form-error" role="alert" style={{ marginTop: '4px' }}>
          <span>⚠</span> {error}
        </div>
      )}
      {hint && !error && <div className="form-hint" style={{ marginTop: '2px' }}>{hint}</div>}
    </div>
  )
}

export default function RegistrationForm({ student, onBack, onComplete }) {
  const isEdit = Boolean(student)
  const [form, setForm] = useState(student
    ? { name: student.name, regNo: student.regNo, dept: student.dept || 'IT', section: student.section, email: student.email }
    : INITIAL_FORM
  )
  const [errors, setErrors] = useState(INITIAL_ERRORS)
  const [touched, setTouched] = useState({})
  const [showConsent, setShowConsent] = useState(false)
  const [consentGiven, setConsentGiven] = useState(
    () => sessionStorage.getItem('consentGiven') === 'true'
  )
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Duplicate regNo detection on blur
  const handleRegNoBlur = useCallback(async (value) => {
    const trimmed = (value || '').trim().toUpperCase()
    if (!trimmed || isEdit) return
    try {
      const result = await checkRegNo(trimmed)
      if (result.exists) {
        setDuplicateWarning(result)
      } else {
        setDuplicateWarning(null)
      }
    } catch (e) {
      console.error('Error checking regNo uniqueness:', e)
    }
  }, [isEdit])

  const handleChange = (field, value) => {
    const processedValue = field === 'regNo' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : value
    setForm(prev => ({ ...prev, [field]: processedValue }))

    if (touched[field]) {
      setErrors(prev => ({ ...prev, [field]: validateField(field, processedValue) }))
    }

    if (field === 'regNo') {
      setDuplicateWarning(null)
    }
  }

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    const errorMsg = validateField(field, form[field])
    setErrors(prev => ({ ...prev, [field]: errorMsg }))

    if (field === 'regNo' && !errorMsg) {
      handleRegNoBlur(form.regNo)
    }
  }

  const validateAll = () => {
    const fields = ['name', 'regNo', 'section', 'email']
    const newErrors = {}
    let hasError = false

    for (const f of fields) {
      const err = validateField(f, form[f])
      newErrors[f] = err
      if (err) hasError = true
    }

    setErrors(prev => ({ ...prev, ...newErrors }))
    setTouched({ name: true, regNo: true, section: true, email: true })
    return !hasError
  }

  const doSave = async () => {
    setIsSubmitting(true)
    try {
      const studentData = {
        regNo: form.regNo.trim().toUpperCase(),
        name: form.name.trim(),
        dept: form.dept,
        section: form.section,
        email: form.email.trim().toLowerCase(),
        createdAt: student?.createdAt || new Date().toISOString(),
        status: student?.status || 'pending',
      }
      const saved = await saveStudent(studentData)
      onComplete(saved)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!validateAll()) return

    // If duplicate exists and user didn't explicitly override via button, block
    if (duplicateWarning && !isEdit) {
      return
    }

    if (!consentGiven) {
      setShowConsent(true)
      return
    }

    await doSave()
  }

  const handleConsentAccept = () => {
    sessionStorage.setItem('consentGiven', 'true')
    setConsentGiven(true)
    setShowConsent(false)
    doSave()
  }

  const getInputClass = (field) => {
    const classes = ['form-input']
    if (touched[field] && errors[field]) classes.push('form-input--error')
    else if (touched[field] && !errors[field] && form[field]) classes.push('form-input--success')
    return classes.join(' ')
  }

  const cleanName = form.name.trim().replace(/[^a-zA-Z0-9]/g, '')
  const folderPreview = form.regNo.trim() ? `${form.regNo.trim().toUpperCase()}_${cleanName || 'StudentName'}` : ''

  return (
    <>
      {showConsent && (
        <ConsentModal
          onAccept={handleConsentAccept}
          onDecline={() => setShowConsent(false)}
        />
      )}

      <div className="page">
        {/* Navigation Bar */}
        <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
          <button
            id="reg-form-back-btn"
            className="btn btn--ghost btn--sm"
            onClick={onBack}
            aria-label="Go back to student list"
          >
            ← Back to Roster
          </button>
          <div>
            {isEdit ? (
              <span className="badge badge--warning">✏ Updating Record</span>
            ) : (
              <span className="badge badge--accent font-mono">Step 1 · Registration</span>
            )}
          </div>
        </div>

        {/* Header Title */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ fontSize: '1.625rem', marginBottom: '4px', letterSpacing: '-0.02em' }}>
            {isEdit ? 'Update Student Record' : 'Student Biometric Registration'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Enter verified academic credentials. All 4 captured photos will be strictly isolated under this student's identity.
          </p>
        </div>

        {/* Live Folder Preview Pill */}
        {folderPreview && (
          <div className="folder-preview-pill" style={{ marginBottom: 'var(--space-5)' }}>
            <span>📁 Training Target:</span>
            <strong style={{ color: '#ffffff' }}>students/{folderPreview}/</strong>
          </div>
        )}

        {/* Duplicate Record Warning Card */}
        {duplicateWarning && (
          <div
            className="card"
            style={{
              borderColor: duplicateWarning.isComplete ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.45)',
              background: duplicateWarning.isComplete ? 'var(--danger-subtle)' : 'var(--warning-subtle)',
              marginBottom: 'var(--space-5)',
            }}
            role="alert"
          >
            <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.1rem' }}>{duplicateWarning.isComplete ? '⛔' : '⚠'}</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {duplicateWarning.isComplete ? 'Existing Complete Dataset' : 'In-Progress Record'}
                </strong>
              </div>
              <span className={`badge ${duplicateWarning.isComplete ? 'badge--danger' : 'badge--warning'}`}>
                {duplicateWarning.isComplete ? 'Complete' : 'Incomplete'}
              </span>
            </div>

            <p style={{ fontSize: '0.8125rem', marginBottom: 'var(--space-4)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{duplicateWarning.student.regNo}</span>
              {' '}— {duplicateWarning.student.name} ({duplicateWarning.student.dept}-{duplicateWarning.student.section}) is already registered in local storage.
              {duplicateWarning.isComplete
                ? ' Recapturing will overwrite the existing 4 biometric images for this student.'
                : ' You can continue capturing images where this student left off.'}
            </p>

            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <button
                id="duplicate-proceed-btn"
                type="button"
                className={`btn btn--sm ${duplicateWarning.isComplete ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => {
                  setDuplicateWarning(null)
                  if (!consentGiven) {
                    setShowConsent(true)
                  } else {
                    doSave()
                  }
                }}
              >
                {duplicateWarning.isComplete ? 'Overwrite & Recapture' : 'Continue Capture'}
              </button>
              <button
                id="duplicate-cancel-btn"
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  setDuplicateWarning(null)
                  setForm(prev => ({ ...prev, regNo: '' }))
                }}
              >
                Use Different Reg.No
              </button>
            </div>
          </div>
        )}

        {/* Registration Form */}
        <form
          id="student-registration-form"
          onSubmit={handleSubmit}
          className="stack-4"
          noValidate
        >
          {/* Full Name */}
          <FormField id="field-name" label="Full Student Name" required error={errors.name}>
            <input
              id="field-name"
              type="text"
              className={getInputClass('name')}
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              autoComplete="name"
              spellCheck={false}
            />
          </FormField>

          {/* Registration Number */}
          <FormField
            id="field-regno"
            label="Registration Number (Reg.No)"
            required
            error={errors.regNo}
            hint="Primary dataset key (e.g. 21IT001)"
          >
            <input
              id="field-regno"
              type="text"
              className={`${getInputClass('regNo')} font-mono`}
              placeholder="e.g. 21IT001"
              value={form.regNo}
              onChange={e => handleChange('regNo', e.target.value)}
              onBlur={() => handleBlur('regNo')}
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
            />
          </FormField>

          {/* Dept & Section Split */}
          <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <FormField id="field-dept" label="Department" required>
                <div className="form-select-wrapper">
                  <select
                    id="field-dept"
                    className="form-select"
                    value={form.dept}
                    onChange={e => handleChange('dept', e.target.value)}
                    onBlur={() => handleBlur('dept')}
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>Dept: {d}</option>)}
                  </select>
                </div>
              </FormField>
            </div>

            <div style={{ flex: 1 }}>
              <FormField id="field-section" label="Section" required error={errors.section}>
                <div className="form-select-wrapper">
                  <select
                    id="field-section"
                    className={`form-select${errors.section && touched.section ? ' form-input--error' : ''}`}
                    value={form.section}
                    onChange={e => handleChange('section', e.target.value)}
                    onBlur={() => handleBlur('section')}
                  >
                    <option value="">Select Section</option>
                    {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
              </FormField>
            </div>
          </div>

          {/* College Email */}
          <FormField
            id="field-email"
            label="College Email ID"
            required
            error={errors.email}
            hint="Institutional verification email"
          >
            <input
              id="field-email"
              type="email"
              className={getInputClass('email')}
              placeholder="e.g. student@college.edu"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              autoComplete="email"
              inputMode="email"
            />
          </FormField>

          {/* Submit Action */}
          <div style={{ paddingTop: 'var(--space-3)' }}>
            <button
              id="reg-form-submit-btn"
              type="submit"
              className="btn btn--primary btn--full btn--lg"
              disabled={isSubmitting}
              style={{
                boxShadow: '0 4px 18px var(--accent-glow)',
                fontSize: '1rem',
                padding: '14px 20px'
              }}
            >
              {isSubmitting ? 'Saving Student Record…' : 'Proceed to Biometric Camera →'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
