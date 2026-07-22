/*
  json-schema.js
  Infers a JSON Schema from a sample payload. The type inference itself lives
  in infer.js (shared with the code generator); this file is the schema-flavoured
  presentation of it — draft selection, title, and the option plumbing.
*/

(function () {
  const { infer, finalizeSchema, countNodes } = window.JStudioInfer;
  const $ = TK.$;

  const SAMPLE = JSON.stringify({
    orderId: '8f14e45f-ceea-467a-9b3c-2a0f9d1b7c11',
    placedAt: '2026-03-14T09:21:00Z',
    status: 'shipped',
    total: 249.95,
    currency: 'USD',
    customer: {
      id: 4821,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      newsletter: true,
      website: 'https://example.com/ada'
    },
    items: [
      { sku: 'KB-113', name: 'Mechanical keyboard', qty: 1, price: 189.0, giftWrap: false },
      { sku: 'CB-007', name: 'USB-C cable', qty: 2, price: 30.475 }
    ],
    tags: ['priority', 'gift'],
    cancelledAt: null
  }, null, 2);

  const DRAFT_URI = {
    '2020-12': 'https://json-schema.org/draft/2020-12/schema',
    '07': 'http://json-schema.org/draft-07/schema#'
  };

  TK.tool({
    sample: SAMPLE,
    filename: 'schema.json',
    mime: 'application/schema+json',
    options: ['opt-draft', 'opt-title', 'opt-required', 'opt-formats', 'opt-enums', 'opt-examples', 'opt-noadd'],
    errHint: 'Nothing to show — fix the JSON first.',
    run(text) {
      const data = TK.parseJSON(text);
      const cfg = {
        required: $('opt-required').checked,
        formats: $('opt-formats').checked,
        enums: $('opt-enums').checked,
        examples: $('opt-examples').checked,
        noadd: $('opt-noadd').checked
      };

      const schema = finalizeSchema(infer(data), cfg);
      const title = $('opt-title').value.trim();

      // $schema and title lead, then the inferred body — key order matters for
      // readability even though JSON objects are unordered.
      const doc = Object.assign(
        { $schema: DRAFT_URI[$('opt-draft').value] },
        title ? { title } : {},
        schema
      );

      return {
        output: JSON.stringify(doc, null, 2),
        inMsg: 'Valid JSON · ' + text.length.toLocaleString() + ' chars',
        outMsg: 'Schema generated · ' + countNodes(schema) + ' nodes · draft ' + $('opt-draft').value
      };
    }
  });
})();
