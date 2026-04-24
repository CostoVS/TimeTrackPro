const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/s\.clock_in \? formatTime\(\)/g, "s.clock_in ? formatTime(s.clock_in)");
content = content.replace(/s\.clock_out \? formatTime\(\)/g, "s.clock_out ? formatTime(s.clock_out)");
content = content.replace(/s\.tea_out \? `\$\{formatTime\(\)\}/g, "s.tea_out ? `${formatTime(s.tea_out)}");
content = content.replace(/s\.tea_in \? formatTime\(\)/g, "s.tea_in ? formatTime(s.tea_in)");
content = content.replace(/s\.lunch_out \? `\$\{formatTime\(\)\}/g, "s.lunch_out ? `${formatTime(s.lunch_out)}");
content = content.replace(/s\.lunch_in \? formatTime\(\)/g, "s.lunch_in ? formatTime(s.lunch_in)");

content = content.replace(/item\.val \? formatTime\(\)/g, "item.val ? formatTime(item.val)");

content = content.replace(/upcomingFutureShifts\[0\]\.clock_in \? formatTime\(\)/g, "upcomingFutureShifts[0].clock_in ? formatTime(upcomingFutureShifts[0].clock_in)");
content = content.replace(/upcomingFutureShifts\[0\]\.clock_out \? formatTime\(\)/g, "upcomingFutureShifts[0].clock_out ? formatTime(upcomingFutureShifts[0].clock_out)");

content = content.replace(/editingSession\.clock_in\.includes\('T'\) \? formatTime\(\)/g, "editingSession.clock_in.includes('T') ? formatTime(editingSession.clock_in)");
content = content.replace(/editingSession\.clock_out\.includes\('T'\) \? formatTime\(\)/g, "editingSession.clock_out.includes('T') ? formatTime(editingSession.clock_out)");
content = content.replace(/editingSession\.tea_out\.includes\('T'\) \? formatTime\(\)/g, "editingSession.tea_out.includes('T') ? formatTime(editingSession.tea_out)");
content = content.replace(/editingSession\.tea_in\.includes\('T'\) \? formatTime\(\)/g, "editingSession.tea_in.includes('T') ? formatTime(editingSession.tea_in)");
content = content.replace(/editingSession\.lunch_out\.includes\('T'\) \? formatTime\(\)/g, "editingSession.lunch_out.includes('T') ? formatTime(editingSession.lunch_out)");
content = content.replace(/editingSession\.lunch_in\.includes\('T'\) \? formatTime\(\)/g, "editingSession.lunch_in.includes('T') ? formatTime(editingSession.lunch_in)");

content = content.replace(/try \{ return formatTime\(\); \}/g, "try { return format(parseISO(val), 'HH:mm'); }");

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed args");
