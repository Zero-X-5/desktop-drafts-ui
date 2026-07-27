const fs = require('fs');
const path = require('path');
const os = require('os');

const folder = path.join(os.homedir(), 'Documents', 'Shijian');

function ensureFolder(){
  if(!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive:true});
}

function getTitle(content, fallback='新建草稿'){
  const firstLine = (content || '').split(/\r?\n/)[0].trim();
  return firstLine.slice(0,40) || fallback;
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
        title:file.replace('.txt',''),
        preview:content.slice(0,80),
        content,
        path:filePath,
        modified:fs.statSync(filePath).mtimeMs
      };
    })
    .sort((a,b)=>b.modified-a.modified);
}

function saveNote(note){
  ensureFolder();
  let filePath = note.path || path.join(folder, `${getTitle(note.content, note.title)}.txt`);

  const newTitle = getTitle(note.content, note.title);
  const renamedPath = path.join(folder, `${newTitle}.txt`);

  if(filePath !== renamedPath && !fs.existsSync(renamedPath)){
    if(fs.existsSync(filePath)) fs.renameSync(filePath, renamedPath);
    filePath = renamedPath;
  }

  fs.writeFileSync(filePath, note.content || '', 'utf8');
  return filePath;
}

function createNote(){
  ensureFolder();
  const filePath = path.join(folder, `新建草稿-${Date.now()}.txt`);
  fs.writeFileSync(filePath,'','utf8');
  return filePath;
}

function watchNotes(callback){
  ensureFolder();
  return fs.watch(folder, {recursive:false}, (event, filename)=>{
    if(filename && filename.endsWith('.txt')) callback({event, filename});
  });
}

module.exports={readNotes,saveNote,createNote,watchNotes};