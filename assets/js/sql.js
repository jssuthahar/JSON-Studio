/*
  sql.js
  JSON array -> CREATE TABLE + INSERT statements.

  Column types are inferred from every row, not the first one: a column that is
  1, 2, 3.5 has to be a decimal, and a column that is ever null has to be
  nullable. Nested objects and arrays are stored as JSON text, which is what
  every one of these databases would have you do anyway.
*/

(function () {
  const $ = TK.$;

  const SAMPLE = JSON.stringify([
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', signupDate: '2026-01-14', credits: 120, active: true, meta: { plan: 'pro' } },
    { id: 2, name: "Grace O'Hopper", email: 'grace@example.com', signupDate: '2026-02-02', credits: 99.5, active: false, meta: null },
    { id: 3, name: 'Alan Turing', email: 'alan@example.com', signupDate: '2026-03-11', credits: 0, active: true }
  ], null, 2);

  const DIALECTS = {
    postgres: {
      quote: (id) => '"' + id.replace(/"/g, '""') + '"',
      types: { integer: 'BIGINT', number: 'NUMERIC', boolean: 'BOOLEAN', 'date-time': 'TIMESTAMPTZ', date: 'DATE', json: 'JSONB', string: (n) => (n > 255 ? 'TEXT' : 'VARCHAR(' + cap(n) + ')') }
    },
    mysql: {
      quote: (id) => '`' + id.replace(/`/g, '``') + '`',
      types: { integer: 'BIGINT', number: 'DECIMAL(18,6)', boolean: 'TINYINT(1)', 'date-time': 'DATETIME', date: 'DATE', json: 'JSON', string: (n) => (n > 255 ? 'TEXT' : 'VARCHAR(' + cap(n) + ')') }
    },
    mssql: {
      quote: (id) => '[' + id.replace(/]/g, ']]') + ']',
      types: { integer: 'BIGINT', number: 'DECIMAL(18,6)', boolean: 'BIT', 'date-time': 'DATETIME2', date: 'DATE', json: 'NVARCHAR(MAX)', string: (n) => (n > 4000 ? 'NVARCHAR(MAX)' : 'NVARCHAR(' + cap(n) + ')') }
    },
    sqlite: {
      quote: (id) => '"' + id.replace(/"/g, '""') + '"',
      types: { integer: 'INTEGER', number: 'REAL', boolean: 'INTEGER', 'date-time': 'TEXT', date: 'TEXT', json: 'TEXT', string: () => 'TEXT' }
    }
  };

  // Round the observed max length up so a slightly longer value later still fits.
  function cap(n) {
    const sizes = [16, 32, 64, 128, 255, 512, 1024, 4000];
    return sizes.find((s) => s >= n) || 4000;
  }

  const words = (s) => String(s).replace(/[^A-Za-z0-9]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().split(/\s+/).filter(Boolean);
  const snake = (s) => words(s).map((w) => w.toLowerCase()).join('_') || 'col';

  const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}/;
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

  function classify(value, col) {
    if (value === null || value === undefined) { col.nullable = true; return; }
    if (typeof value === 'boolean') { col.kinds.add('boolean'); return; }
    if (typeof value === 'number') { col.kinds.add(Number.isInteger(value) ? 'integer' : 'number'); return; }
    if (typeof value === 'object') { col.kinds.add('json'); col.maxLen = Math.max(col.maxLen, JSON.stringify(value).length); return; }
    const s = String(value);
    col.maxLen = Math.max(col.maxLen, s.length);
    if (DATE_TIME.test(s)) col.kinds.add('date-time');
    else if (DATE_ONLY.test(s)) col.kinds.add('date');
    else col.kinds.add('string');
  }

  // Any disagreement between rows widens the column — text is the safe floor.
  function resolveKind(kinds) {
    if (kinds.size === 0) return 'string';
    if (kinds.size === 1) return [...kinds][0];
    if (kinds.has('json')) return 'json';
    if (kinds.has('string')) return 'string';
    if (kinds.has('date-time') && kinds.has('date')) return 'date-time';
    if (kinds.has('number') && kinds.has('integer')) return 'number';
    return 'string';
  }

  function literal(value, kind, dialect) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') {
      if (dialect === 'mssql' || dialect === 'sqlite' || dialect === 'mysql') return value ? '1' : '0';
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') return String(value);
    const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return "'" + s.replace(/'/g, "''") + "'";
  }

  TK.tool({
    sample: SAMPLE,
    filename: () => ($('opt-table').value.trim() || 'my_table') + '.sql',
    mime: 'text/plain',
    options: ['opt-dialect', 'opt-table', 'opt-create', 'opt-multi', 'opt-snake'],
    run(text) {
      const data = TK.parseJSON(text);
      const rows = Array.isArray(data) ? data : [data];
      if (!rows.length) throw new Error('The array is empty — nothing to generate.');
      rows.forEach((r, i) => {
        if (!r || typeof r !== 'object' || Array.isArray(r)) {
          throw new Error('Row ' + (i + 1) + ' is not an object. SQL generation needs an array of objects.');
        }
      });

      const dialectName = $('opt-dialect').value;
      const dialect = DIALECTS[dialectName];
      const table = $('opt-table').value.trim() || 'my_table';
      const useSnake = $('opt-snake').checked;

      // Union of keys in first-seen order, so a field that only appears in later
      // rows still gets a column.
      const cols = new Map();
      rows.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (!cols.has(key)) cols.set(key, { key, kinds: new Set(), nullable: false, maxLen: 1 });
          classify(row[key], cols.get(key));
        });
        // A key missing from a row is a NULL in that row.
        cols.forEach((col, key) => { if (!(key in row)) col.nullable = true; });
      });

      const columns = [...cols.values()].map((col) => {
        const kind = resolveKind(col.kinds);
        const t = dialect.types[kind];
        return {
          key: col.key,
          name: useSnake ? snake(col.key) : col.key,
          kind,
          nullable: col.nullable,
          sqlType: typeof t === 'function' ? t(col.maxLen) : t
        };
      });

      const q = dialect.quote;
      const out = [];

      if ($('opt-create').checked) {
        const defs = columns.map((c) => '  ' + q(c.name) + ' ' + c.sqlType + (c.nullable ? ' NULL' : ' NOT NULL'));
        out.push('CREATE TABLE ' + q(table) + ' (\n' + defs.join(',\n') + '\n);');
        out.push('');
      }

      const colList = columns.map((c) => q(c.name)).join(', ');
      const valuesFor = (row) => '(' + columns.map((c) => literal(row[c.key], c.kind, dialectName)).join(', ') + ')';

      if ($('opt-multi').checked) {
        // Chunked because MySQL and SQL Server both cap statement size/row count.
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          out.push('INSERT INTO ' + q(table) + ' (' + colList + ') VALUES\n' +
            chunk.map(valuesFor).map((v) => '  ' + v).join(',\n') + ';');
        }
      } else {
        rows.forEach((row) => {
          out.push('INSERT INTO ' + q(table) + ' (' + colList + ') VALUES ' + valuesFor(row) + ';');
        });
      }

      const sql = out.join('\n') + '\n';
      return {
        output: sql,
        inMsg: 'Valid JSON · ' + rows.length.toLocaleString() + ' rows',
        outMsg: columns.length + ' columns · ' + rows.length.toLocaleString() + ' inserts · ' + dialectName
      };
    }
  });
})();
