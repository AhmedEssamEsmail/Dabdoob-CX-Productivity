'use client'

import { useState, useEffect } from 'react'

export function LanguageToggle() {
  const [language, setLanguage] = useState<'en' | 'ar'>('en')

  useEffect(() => {
    // Check for saved language preference
    const savedLang = localStorage.getItem('cx-lang') as 'en' | 'ar' | null
    const initialLang = savedLang || 'en'
    
    setLanguage(initialLang)
    document.documentElement.setAttribute('lang', initialLang)
    document.documentElement.setAttribute('dir', initialLang === 'ar' ? 'rtl' : 'ltr')
  }, [])

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ar' : 'en'
    setLanguage(newLang)
    localStorage.setItem('cx-lang', newLang)
    document.documentElement.setAttribute('lang', newLang)
    document.documentElement.setAttribute('dir', newLang === 'ar' ? 'rtl' : 'ltr')
  }

  return (
    <button
      onClick={toggleLanguage}
      className="p-(--cx-space-2) rounded-(--cx-radius-control) hover:bg-(--cx-accent-soft) transition-colors font-medium"
      aria-label={`Switch to ${language === 'en' ? 'Arabic' : 'English'}`}
    >
      {language === 'en' ? 'ع' : 'EN'}
    </button>
  )
}
