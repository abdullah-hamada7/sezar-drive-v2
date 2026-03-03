const request = require('supertest');
const express = require('express');
const { body, validationResult } = require('express-validator');

// Lightweight app for testing validation logic
const app = express();
app.use(express.json());

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

app.post('/test-sanitization', [
  body('text').trim().escape()
], handleValidation, (req, res) => {
  res.json({ sanitized: req.body.text });
});

describe('XSS Sanitization', () => {
  it('should escape HTML tags in the text field', async () => {
    const maliciousText = '<script>alert("XSS")</script>';
    const expectedText = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;';
    
    const res = await request(app)
      .post('/test-sanitization')
      .send({ text: maliciousText });
    
    expect(res.body.sanitized).toBe(expectedText);
  });

  it('should preserve normal text', async () => {
    const normalText = 'This is normal text.';
    const res = await request(app)
      .post('/test-sanitization')
      .send({ text: normalText });
    
    expect(res.body.sanitized).toBe(normalText);
  });
  
  it('should escape partially malicious text', async () => {
    const mixedText = 'Hello <b>World</b>';
    const expectedText = 'Hello &lt;b&gt;World&lt;&#x2F;b&gt;';
    
    const res = await request(app)
      .post('/test-sanitization')
      .send({ text: mixedText });
    
    expect(res.body.sanitized).toBe(expectedText);
  });
});
