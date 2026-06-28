import CodeMirror from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import { css as cssLang } from '@codemirror/lang-css'
import { oneDark } from '@codemirror/theme-one-dark'

interface VaultCodeMirrorProps {
  value: string
  editorTab: 'html' | 'css'
  onChange: (val: string) => void
  style?: React.CSSProperties
}

export function VaultCodeMirror({ value, editorTab, onChange, style }: VaultCodeMirrorProps) {
  return (
    <CodeMirror
      value={value}
      extensions={[editorTab === 'html' ? htmlLang() : cssLang()]}
      theme={oneDark}
      onChange={onChange}
      style={style}
    />
  )
}
