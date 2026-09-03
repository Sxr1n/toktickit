import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const MAX_FILES = 5

interface Props {
  files: File[]
  onChange: (files: File[]) => void
}

export default function AttachmentPicker({ files, onChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!selected) return

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError(`"${selected.name}" is not an allowed file type. Use JPG, PNG, WEBP, or PDF.`)
      return
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError(`"${selected.name}" is larger than 5 MB.`)
      return
    }
    if (files.length >= MAX_FILES) {
      setError('A Ticket can have at most 5 attachments.')
      return
    }

    setError(null)
    onChange([...files, selected])
  }

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label htmlFor="attachment-input" className="form-label">
        Attachments
      </label>
      <input
        id="attachment-input"
        ref={inputRef}
        type="file"
        className="form-control"
        onChange={handleFileSelect}
        disabled={files.length >= MAX_FILES}
      />
      {error && (
        <p className="text-danger mt-1 mb-0" role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="list-group mt-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                {file.name} ({Math.round(file.size / 1024)} KB)
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(index)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
