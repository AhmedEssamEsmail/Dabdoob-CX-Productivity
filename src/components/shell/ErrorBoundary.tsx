'use client'

import { Component, type ReactNode } from 'react'

/** wa — per-page error boundary with the legacy retry screen. */
export default class ErrorBoundary extends Component<
  { title: ReactNode; children?: ReactNode },
  { error: string }
> {
  constructor(props: { title: ReactNode; children?: ReactNode }) {
    super(props)
    this.state = { error: '' }
  }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (this.state.error) {
      return (
        <section className="page" aria-labelledby="page-title">
          <h1 id="page-title" className="page-title">
            {this.props.title}
          </h1>
          <p className="field-error" role="alert">
            This page hit an error and could not be shown: {this.state.error}
          </p>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => this.setState({ error: '' })}
          >
            Try again
          </button>
        </section>
      )
    }
    return this.props.children
  }
}
