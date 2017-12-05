import * as express from 'express'
import * as multer from 'multer'
import * as cors from 'cors'
import * as fs from 'fs'
import * as path from 'path'
import * as Loki from 'lokijs'
import { imageFilter, loadCollection, cleanFolder } from './utils';

// setup
const DB_NAME = 'db.json';
const COLLECTION_NAME = 'images';
const UPLOAD_PATH = 'uploads';
const upload = multer({ dest: `${UPLOAD_PATH}/`});
const db = new Loki(`${UPLOAD_PATH}/${DB_NAME}`, { persistenceMethod: 'fs' });

// optional: clean all data before start
// cleanFolder(UPLOAD_PATH);

// app
const app = express();
app.use(cors());

app.post('/photo/upload', upload.single('photos'), async (req, res) => {
  try {
    const col = await loadCollection(COLLECTION_NAME, db);
    const data = col.insert(req.file);
    const source_path=UPLOAD_PATH+"/"+data.filename;
    const compressed_path= UPLOAD_PATH+"/"+data.filename+"final";

    var exec = require('child_process').exec;
    var child = exec('./main.o'+" "+source_path+" "+compressed_path);
    child.stdout.on('data', function(data) {
      console.log('stdout: ' + data);
    });
    child.stderr.on('data', function(data) {
      console.log('stdout: ' + data);
    });
    child.on('close', function(code) {
      console.log('closing code: ' + code);
      const data_comp = col.insert({"fieldname":"photos","originalname":"bin_"+data.originalname,"encoding":"7bit","mimetype":"image/bmp","destination":UPLOAD_PATH,"filename":data.filename+"_compressed","path":source_path+"_compressed"});
      const data_after_comp= col.insert({"fieldname":"photos","originalname":"compressed_"+data.originalname,"encoding":"7bit","mimetype":"image/bmp","destination":UPLOAD_PATH,"filename":data.filename+"final","path":source_path+"final"});
      db.saveDatabase();
      res.send([{ id: data.$loki, fileName: data.filename, originalName: data.originalname },{ id: data_after_comp.$loki, fileName: data_after_comp.filename, originalName: data_after_comp.originalname },{ id: data_comp.$loki, fileName: data_comp.filename, originalName: data_comp.originalname }]);
    });
    // var execSync = require('exec-sync');
    //
    // const compress= execSync("./main.o", [source_path,compressed_path]);
  }
  catch (err) {
    res.sendStatus(400);
  }
})

app.post('/photos/upload', upload.array('photos', 12), async (req, res) => {
  try {
    const col = await loadCollection(COLLECTION_NAME, db)
    let data = [].concat(col.insert(req.files));

    db.saveDatabase();
    res.send(data.map(x => ({ id: x.$loki, fileName: x.filename, originalName: x.originalname })));
  } catch (err) {
    res.sendStatus(400);
  }
})

app.get('/images', async (req, res) => {
  try {
    const col = await loadCollection(COLLECTION_NAME, db);
    res.send(col.data);
  } catch (err) {
    res.sendStatus(400);
  }
})

app.get('/images/:id', async (req, res) => {
  try {
    const col = await loadCollection(COLLECTION_NAME, db);
    const result = col.get(req.params.id);

    if (!result) {
      res.sendStatus(404);
      return;
    };

    res.setHeader('Content-Type', result.mimetype);
    fs.createReadStream(path.join(UPLOAD_PATH, result.filename)).pipe(res);
  } catch (err) {
    res.sendStatus(400);
  }
})
cleanFolder(UPLOAD_PATH);
app.listen(3001, function () {
  console.log('listening on port 3000!');
})
