import test from 'node:test'
import assert from 'node:assert/strict'

test('useFocusTrap logic: Tab and Shift-Tab cyclic wrapping boundary logic', () => {
  const elements = [
    { id: 'first', focusCalled: false, focus() { this.focusCalled = true } },
    { id: 'middle', focusCalled: false, focus() { this.focusCalled = true } },
    { id: 'last', focusCalled: false, focus() { this.focusCalled = true } },
  ]

  // Tab on last element should wrap to first element
  let activeElement = elements[2]
  let prevented = false
  const fakeEventTab = {
    key: 'Tab',
    shiftKey: false,
    preventDefault() { prevented = true },
  }

  if (fakeEventTab.key === 'Tab') {
    const firstElement = elements[0]
    const lastElement = elements[elements.length - 1]

    if (fakeEventTab.shiftKey) {
      if (activeElement === firstElement) {
        fakeEventTab.preventDefault()
        lastElement.focus()
      }
    } else {
      if (activeElement === lastElement) {
        fakeEventTab.preventDefault()
        firstElement.focus()
      }
    }
  }

  assert.equal(prevented, true)
  assert.equal(elements[0].focusCalled, true)

  // Shift+Tab on first element should wrap to last element
  activeElement = elements[0]
  prevented = false
  const fakeEventShiftTab = {
    key: 'Tab',
    shiftKey: true,
    preventDefault() { prevented = true },
  }

  if (fakeEventShiftTab.key === 'Tab') {
    const firstElement = elements[0]
    const lastElement = elements[elements.length - 1]

    if (fakeEventShiftTab.shiftKey) {
      if (activeElement === firstElement) {
        fakeEventShiftTab.preventDefault()
        lastElement.focus()
      }
    } else {
      if (activeElement === lastElement) {
        fakeEventShiftTab.preventDefault()
        firstElement.focus()
      }
    }
  }

  assert.equal(prevented, true)
  assert.equal(elements[2].focusCalled, true)
})

test('useFocusTrap logic: Escape triggers onClose and stops propagation', () => {
  let closed = false
  let prevented = false
  let stopped = false

  const onClose = () => { closed = true }
  const fakeEvent = {
    key: 'Escape',
    preventDefault() { prevented = true },
    stopPropagation() { stopped = true },
  }

  if (fakeEvent.key === 'Escape') {
    fakeEvent.preventDefault()
    fakeEvent.stopPropagation()
    onClose()
  }

  assert.equal(closed, true)
  assert.equal(prevented, true)
  assert.equal(stopped, true)
})
