const fs = require('fs');
const data = fs.readFileSync('./src/data/ai_fixtures.json', 'utf8');

try {
    JSON.parse(data);
    console.log("JSON is valid");
} catch (e) {
    console.log(e.message);
    
    // Let's find the unclosed bracket
    let depth = 0;
    let inString = false;
    let escape = false;
    let lastKey = '';
    
    for (let i = 0; i < data.length; i++) {
        const c = data[i];
        if (inString) {
            if (escape) escape = false;
            else if (c === '\\') escape = true;
            else if (c === '"') inString = false;
        } else {
            if (c === '"') inString = true;
            else if (c === '{' || c === '[') depth++;
            else if (c === '}' || c === ']') depth--;
        }
        
        if (depth < 0) {
            console.log('Negative depth at index', i, 'Line near:', data.substring(i - 40, i + 40));
            break;
        }
    }
    console.log('Final depth:', depth);
}
