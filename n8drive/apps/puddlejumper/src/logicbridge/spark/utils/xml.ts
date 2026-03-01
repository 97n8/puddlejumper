// spark.utils.xml — lightweight XML parse/stringify

export function createSparkXml() {
  return {
    parse(xmlStr: string): Record<string, unknown> {
      // Simple regex-based XML → JSON (V1, no XPath)
      return naiveXmlParse(xmlStr);
    },
    stringify(obj: Record<string, unknown>, rootTag = 'root'): string {
      return naiveXmlStringify(obj, rootTag);
    },
  };
}

function naiveXmlParse(xml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const tagRegex = /<([A-Za-z_][\w.-]*)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, tag, , content] = match;
    const trimmed = content.trim();
    // Recurse if nested tags exist
    if (/<[A-Za-z]/.test(trimmed)) {
      result[tag] = naiveXmlParse(trimmed);
    } else {
      result[tag] = trimmed;
    }
  }
  return result;
}

function naiveXmlStringify(obj: Record<string, unknown>, tag: string): string {
  const inner = Object.entries(obj)
    .map(([k, v]) => {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return naiveXmlStringify(v as Record<string, unknown>, k);
      }
      return `<${k}>${String(v ?? '')}</${k}>`;
    })
    .join('');
  return `<${tag}>${inner}</${tag}>`;
}
