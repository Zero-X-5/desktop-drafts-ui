const fs = require('fs');
const path = require('path');
const os = require('os');

const folder = path.join(os.homedir(), 'Documents', 'Shijian');

function ensureFolder(){
  if(!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive:true});
}

function readNotes(){
  ensureFolder();
  return fs.readdirSync(folder)
    .filter(file => file.endsWith('.txt'))
    .map((file,index)=>{
      const filePath = path.join(folder,file);
      const content = fs.readFileSync(filePath,'utf8');
      return {
        id:index,
        title: file.replace('.txt',''),
        preview: content.slice(0,40),
        content,
        path:filePath
      };
    });
}

function saveNote(note){
  ensureFolder();
  const filePath = note.path || path.join(folder, `${note.title || 'untitled'}.txt`);
  fs.writeFileSync(filePath, note.content || '', 'utf8');
  return filePath;
}

function createNote(){
  ensureFolder();
  const filePath = path.join(folder, `新建草稿-${Date.now()}.txt`);
  fs.writeFileSync(filePath,'','utf8');
  return filePath;
}

module.exports={readNotes,saveNote,createNote};
