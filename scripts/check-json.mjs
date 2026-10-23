import {readdir,readFile} from "node:fs/promises";
import path from "node:path";
let bad=0;
async function walk(dir){let items;try{items=await readdir(dir,{withFileTypes:true})}catch{return}for(const i of items){const p=path.join(dir,i.name);if(i.isDirectory())await walk(p);else if(i.isFile()&&p.endsWith(".json")){try{JSON.parse(await readFile(p,"utf8"))}catch(e){bad++;console.error(p,e.message)}}}}
await walk(path.resolve("assets/data"));
if(bad)process.exitCode=1;else console.log("JSON syntax check passed.");
