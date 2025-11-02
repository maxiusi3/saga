const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENROUTER_API_KEY = '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';
const baseDir = 'packages/web/public/locales';

const languageNames = {
  'es': 'Spanish (Spain)',
  'fr': 'French (France)',
  'ja': 'Japanese',
  'ko': 'Korean',
  'pt': 'Portuguese (Brazil)',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese'
};

function makeAPICall(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content);
          } else {
            reject(new Error('Invalid API response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function setValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

async function translateBatch(items, targetLang) {
  const translations = {};
  
  for (const item of items) {
    translations[item.key] = item.value;
  }
  
  const prompt = `You are a professional translator. Translate the following English text to ${languageNames[targetLang]}.

Context: This is for a family biography/storytelling application called "Saga" that helps families record and preserve their stories.

Important guidelines:
1. Maintain the same tone and style (warm, friendly, family-oriented)
2. Keep placeholders like {role}, {{context}}, etc. unchanged
3. Preserve any HTML tags or special formatting
4. Use natural, culturally appropriate language
5. For UI elements, use standard terminology for that language

Return ONLY a JSON object with the translations, using the same keys. Format:
{
  "key1": "translated text 1",
  "key2": "translated text 2",
  ...
}

English texts to translate:
${JSON.stringify(translations, null, 2)}`;

  try {
    const response = await makeAPICall(prompt);
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error(`Error translating to ${targetLang}:`, error.message);
    return null;
  }
}

async function main() {
  const tasks = JSON.parse(fs.readFileSync('translation-tasks.json', 'utf8'));
  
  console.log(`Processing ${tasks.length} translation tasks...\n`);
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[${i + 1}/${tasks.length}] Translating ${task.file} to ${task.lang} (${task.items.length} items)...`);
    
    // Split into smaller batches if needed
    const batchSize = 20;
    const batches = [];
    for (let j = 0; j < task.items.length; j += batchSize) {
      batches.push(task.items.slice(j, j + batchSize));
    }
    
    const filePath = path.join(baseDir, task.lang, task.file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`  Batch ${batchIndex + 1}/${batches.length}...`);
      
      const translations = await translateBatch(batch, task.lang);
      
      if (translations) {
        // Update the content with translations
        for (const [key, value] of Object.entries(translations)) {
          setValue(content, key, value);
        }
        
        // Save after each batch
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
        console.log(`  ✓ Saved ${Object.keys(translations).length} translations`);
      } else {
        console.log(`  ✗ Failed to translate batch`);
      }
      
      // Rate limiting - wait 2 seconds between batches
      if (batchIndex < batches.length - 1 || i < tasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`✓ Completed ${task.file} -> ${task.lang}\n`);
  }
  
  console.log('All translations completed!');
}

main().catch(console.error);
