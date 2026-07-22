/*
  code.js
  JSON → typed classes. The type model comes from infer.js, which merges every
  element of an array before generating — so a key present in only some
  elements becomes an optional field rather than disappearing or being
  mistaken for required.

  Adding a language means adding one entry to LANGS: a primitive type map and
  a renderer for a class.
*/

(function () {
  const $ = TK.$;
  const { infer } = window.JStudioInfer;

  const SAMPLE = JSON.stringify({
    orderId: 'A-1001',
    placedAt: '2026-03-14T09:21:00Z',
    total: 249.95,
    paid: true,
    customer: { id: 4821, name: 'Ada Lovelace', email: 'ada@example.com' },
    items: [
      { sku: 'KB-113', name: 'Mechanical keyboard', qty: 1, price: 189.0 },
      { sku: 'CB-007', name: 'USB-C cable', qty: 2, price: 30.48, giftWrap: true }
    ],
    tags: ['priority', 'gift'],
    cancelledAt: null
  }, null, 2);

  /* ---------------- naming ---------------- */

  const words = (s) => String(s).replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim().split(/\s+/).filter(Boolean);

  const pascal = (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Value';
  const camel = (s) => { const p = pascal(s); return p[0].toLowerCase() + p.slice(1); };
  const snake = (s) => words(s).map((w) => w.toLowerCase()).join('_') || 'value';

  // "items" -> "Item", "categories" -> "Category": nested class names read
  // better in the singular since each instance is one element.
  function singular(name) {
    if (/ies$/i.test(name)) return name.slice(0, -3) + 'y';
    if (/(s|es)$/i.test(name) && !/ss$/i.test(name)) return name.replace(/e?s$/i, '');
    return name;
  }

  /* ---------------- model extraction ---------------- */

  // Walk the inferred tree and pull every object out into a named class.
  function extractClasses(root, rootName) {
    const classes = [];
    const used = new Set();

    function nameFor(base) {
      let name = pascal(base) || 'Type';
      let n = 2;
      while (used.has(name)) name = pascal(base) + n++;
      used.add(name);
      return name;
    }

    function visit(node, suggested) {
      if (!node) return { kind: 'any' };
      if (node.anyOf) return { kind: 'any' };

      if (node.type === 'object') {
        const cls = { name: nameFor(suggested), fields: [] };
        classes.push(cls); // push before recursing so nested classes come after
        const required = new Set(node.required || []);
        Object.keys(node.properties || {}).forEach((key) => {
          const child = node.properties[key];
          cls.fields.push({
            key,
            type: visit(child, singular(pascal(key))),
            optional: !required.has(key),
            nullable: child.type === 'null'
          });
        });
        return { kind: 'class', name: cls.name };
      }

      if (node.type === 'array') {
        return { kind: 'array', of: node.items ? visit(node.items, singular(suggested)) : { kind: 'any' } };
      }

      return { kind: node.type };
    }

    const top = visit(root, rootName);
    // A top-level array of objects: the element class is what people want, and
    // the root itself is just a list of it.
    return { classes, top };
  }

  /* ---------------- languages ---------------- */

  const idiomatic = () => $('opt-pascal').checked;
  const attrs = () => $('opt-attrs').checked;
  const nullable = () => $('opt-nullable').checked;

  const LANGS = {
    csharp: {
      ext: 'cs',
      map: { string: 'string', integer: 'long', number: 'double', boolean: 'bool', null: 'object?', any: 'object?' },
      type(t, self) {
        if (t.kind === 'array') return 'List<' + self.type(t.of, self) + '>';
        if (t.kind === 'class') return t.name;
        return self.map[t.kind] || 'object?';
      },
      render(classes) {
        const head = 'using System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\n';
        const body = classes.map((c) => {
          const fields = c.fields.map((f) => {
            let type = this.type(f.type, this);
            if (nullable() && (f.optional || f.nullable) && !type.endsWith('?')) type += '?';
            const name = idiomatic() ? pascal(f.key) : f.key;
            const attr = attrs() ? '    [JsonPropertyName("' + f.key + '")]\n' : '';
            return attr + '    public ' + type + ' ' + name + ' { get; set; }';
          }).join('\n\n');
          return 'public class ' + c.name + '\n{\n' + fields + '\n}';
        }).join('\n\n');
        return (attrs() ? head : 'using System.Collections.Generic;\n\n') + body + '\n';
      }
    },

    typescript: {
      ext: 'ts',
      map: { string: 'string', integer: 'number', number: 'number', boolean: 'boolean', null: 'null', any: 'unknown' },
      type(t, self) {
        if (t.kind === 'array') return self.type(t.of, self) + '[]';
        if (t.kind === 'class') return t.name;
        return self.map[t.kind] || 'unknown';
      },
      render(classes) {
        return classes.map((c) => {
          const fields = c.fields.map((f) => {
            let type = this.type(f.type, this);
            if (nullable() && f.nullable && type !== 'null') type += ' | null';
            return '  ' + (/^[A-Za-z_$][\w$]*$/.test(f.key) ? f.key : JSON.stringify(f.key)) +
              (f.optional ? '?' : '') + ': ' + type + ';';
          }).join('\n');
          return 'export interface ' + c.name + ' {\n' + fields + '\n}';
        }).join('\n\n') + '\n';
      }
    },

    dart: {
      ext: 'dart',
      map: { string: 'String', integer: 'int', number: 'double', boolean: 'bool', null: 'dynamic', any: 'dynamic' },
      type(t, self) {
        if (t.kind === 'array') return 'List<' + self.type(t.of, self) + '>';
        if (t.kind === 'class') return t.name;
        return self.map[t.kind] || 'dynamic';
      },
      render(classes) {
        return classes.map((c) => {
          const decl = c.fields.map((f) => {
            let type = this.type(f.type, this);
            if (nullable() && (f.optional || f.nullable) && !type.endsWith('?') && type !== 'dynamic') type += '?';
            return '  final ' + type + ' ' + camel(f.key) + ';';
          }).join('\n');

          const ctor = c.fields.map((f) => (f.optional || f.nullable || !nullable() ? '    this.' : '    required this.') + camel(f.key) + ',').join('\n');

          const from = c.fields.map((f) => {
            const t = f.type;
            const src = "json['" + f.key + "']";
            let expr;
            if (t.kind === 'class') expr = t.name + '.fromJson(' + src + ' as Map<String, dynamic>)';
            else if (t.kind === 'array' && t.of.kind === 'class') {
              expr = '(' + src + ' as List<dynamic>).map((e) => ' + t.of.name + '.fromJson(e as Map<String, dynamic>)).toList()';
            } else if (t.kind === 'array') expr = '(' + src + ' as List<dynamic>).cast<' + this.type(t.of, this) + '>()';
            else expr = src + ' as ' + this.type(t, this) + (nullable() && (f.optional || f.nullable) ? '?' : '');
            return '        ' + camel(f.key) + ': ' + expr + ',';
          }).join('\n');

          const to = c.fields.map((f) => {
            const t = f.type;
            const name = camel(f.key);
            let expr = name;
            if (t.kind === 'class') expr = name + (nullable() && f.optional ? '?' : '') + '.toJson()';
            else if (t.kind === 'array' && t.of.kind === 'class') expr = name + (nullable() && f.optional ? '?' : '') + '.map((e) => e.toJson()).toList()';
            return "        '" + f.key + "': " + expr + ',';
          }).join('\n');

          return 'class ' + c.name + ' {\n' + decl + '\n\n  ' + c.name + '({\n' + ctor + '\n  });\n\n' +
            '  factory ' + c.name + '.fromJson(Map<String, dynamic> json) => ' + c.name + '(\n' + from + '\n      );\n\n' +
            '  Map<String, dynamic> toJson() => {\n' + to + '\n      };\n}';
        }).join('\n\n') + '\n';
      }
    },

    kotlin: {
      ext: 'kt',
      map: { string: 'String', integer: 'Long', number: 'Double', boolean: 'Boolean', null: 'Any?', any: 'Any?' },
      type(t, self) {
        if (t.kind === 'array') return 'List<' + self.type(t.of, self) + '>';
        if (t.kind === 'class') return t.name;
        return self.map[t.kind] || 'Any?';
      },
      render(classes) {
        const head = attrs() ? 'import kotlinx.serialization.SerialName\nimport kotlinx.serialization.Serializable\n\n' : '';
        return head + classes.map((c) => {
          const fields = c.fields.map((f) => {
            let type = this.type(f.type, this);
            if (nullable() && (f.optional || f.nullable) && !type.endsWith('?')) type += '?';
            const name = idiomatic() ? camel(f.key) : f.key;
            const attr = attrs() ? '    @SerialName("' + f.key + '")\n' : '';
            return attr + '    val ' + name + ': ' + type + (f.optional && nullable() ? ' = null' : '');
          }).join(',\n');
          return (attrs() ? '@Serializable\n' : '') + 'data class ' + c.name + '(\n' + fields + '\n)';
        }).join('\n\n') + '\n';
      }
    },

    java: {
      ext: 'java',
      map: { string: 'String', integer: 'Long', number: 'Double', boolean: 'Boolean', null: 'Object', any: 'Object' },
      type(t, self) {
        if (t.kind === 'array') return 'List<' + self.type(t.of, self) + '>';
        if (t.kind === 'class') return t.name;
        return self.map[t.kind] || 'Object';
      },
      render(classes) {
        const head = 'import java.util.List;\n' + (attrs() ? 'import com.fasterxml.jackson.annotation.JsonProperty;\n' : '') + '\n';
        return head + classes.map((c) => {
          const fields = c.fields.map((f) => {
            const type = this.type(f.type, this);
            const name = idiomatic() ? camel(f.key) : f.key;
            const attr = attrs() ? '    @JsonProperty("' + f.key + '")\n' : '';
            return attr + '    private ' + type + ' ' + name + ';';
          }).join('\n\n');
          const access = c.fields.map((f) => {
            const type = this.type(f.type, this);
            const name = idiomatic() ? camel(f.key) : f.key;
            const cap = pascal(f.key);
            return '    public ' + type + ' get' + cap + '() { return ' + name + '; }\n' +
              '    public void set' + cap + '(' + type + ' ' + name + ') { this.' + name + ' = ' + name + '; }';
          }).join('\n\n');
          return 'public class ' + c.name + ' {\n' + fields + '\n\n' + access + '\n}';
        }).join('\n\n') + '\n';
      }
    },

    python: {
      ext: 'py',
      map: { string: 'str', integer: 'int', number: 'float', boolean: 'bool', null: 'Any', any: 'Any' },
      type(t, self) {
        if (t.kind === 'array') return 'List[' + self.type(t.of, self) + ']';
        if (t.kind === 'class') return t.name;
        return self.map[t.kind] || 'Any';
      },
      render(classes) {
        const head = 'from dataclasses import dataclass, field\nfrom typing import Any, List, Optional\n\n\n';
        // Dataclass fields with defaults must come last, so optional fields sort
        // to the bottom — otherwise the generated code doesn't even import.
        return head + classes.slice().reverse().map((c) => {
          const ordered = c.fields.slice().sort((a, b) => Number(a.optional) - Number(b.optional));
          const fields = ordered.map((f) => {
            let type = this.type(f.type, this);
            if (nullable() && (f.optional || f.nullable)) type = 'Optional[' + type + ']';
            const name = idiomatic() ? snake(f.key) : f.key;
            return '    ' + name + ': ' + type + (f.optional ? ' = None' : '');
          }).join('\n');
          return '@dataclass\nclass ' + c.name + ':\n' + (fields || '    pass');
        }).join('\n\n\n') + '\n';
      }
    },

    go: {
      ext: 'go',
      map: { string: 'string', integer: 'int64', number: 'float64', boolean: 'bool', null: 'interface{}', any: 'interface{}' },
      type(t, self) {
        if (t.kind === 'array') return '[]' + self.type(t.of, self);
        if (t.kind === 'class') return t.name;
        return self.map[t.kind] || 'interface{}';
      },
      render(classes) {
        return 'package main\n\n' + classes.map((c) => {
          const fields = c.fields.map((f) => {
            let type = this.type(f.type, this);
            if (nullable() && (f.optional || f.nullable) && !type.startsWith('[]') && type !== 'interface{}') type = '*' + type;
            const tag = attrs() ? ' `json:"' + f.key + (f.optional ? ',omitempty' : '') + '"`' : '';
            return '\t' + pascal(f.key) + ' ' + type + tag;
          }).join('\n');
          return 'type ' + c.name + ' struct {\n' + fields + '\n}';
        }).join('\n\n') + '\n';
      }
    }
  };

  TK.tool({
    sample: SAMPLE,
    filename: () => {
      const lang = LANGS[$('opt-lang').value];
      const base = $('opt-root').value.trim() || 'Root';
      return (lang.ext === 'py' || lang.ext === 'go' ? snake(base) : pascal(base)) + '.' + lang.ext;
    },
    mime: 'text/plain',
    options: ['opt-lang', 'opt-root', 'opt-attrs', 'opt-nullable', 'opt-pascal'],
    run(text) {
      const data = TK.parseJSON(text);
      const rootName = pascal($('opt-root').value.trim() || 'Root');
      const model = infer(data);

      const { classes, top } = extractClasses(model, rootName);
      if (!classes.length) {
        throw new Error('No object found. Paste an object, or an array of objects, to generate classes from.');
      }

      const lang = LANGS[$('opt-lang').value];
      let code = lang.render(classes);

      if (top.kind === 'array') {
        code += '\n// The payload itself is a list: ' + lang.type(top, lang) + '\n';
      }

      return {
        output: code,
        inMsg: 'Valid JSON · ' + text.length.toLocaleString() + ' chars',
        outMsg: classes.length + ' type' + (classes.length === 1 ? '' : 's') + ' generated · ' + $('opt-lang').value
      };
    }
  });
})();
