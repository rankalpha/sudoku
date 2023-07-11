# -*- coding: utf-8 -*-
import os, re
import uvicorn
from fastapi.templating  import Jinja2Templates
from fastapi.staticfiles import StaticFiles
#from starlette.responses import FileResponse
#from fastapi  import Response, HTTPException
from fastapi  import FastAPI, Request
from pydantic import BaseModel
from futils   import *

client = open_mongodb(os.getenv('MONGODB_STR'))

app = FastAPI()

#app.mount("/html", StaticFiles(directory="html"), name="html")
PRODUCT_MODE = True
if PRODUCT_MODE:
  app.mount('/css', StaticFiles(directory='./css'), name='css')
  app.mount('/js',  StaticFiles(directory='./bundle/js'),  name='js')
  templates = Jinja2Templates(directory='./bundle/templates')
else:
  app.mount('/css', StaticFiles(directory='./css'), name='css')
  app.mount('/js',  StaticFiles(directory='./js'),  name='js')
  templates = Jinja2Templates(directory='templates')

def _fetch_items(query, count):
  src_table = get_src_table(client)
  items = src_table.find(query, projection={'_id': 0}).sort('crc').limit(count)
  return list(items)

def text_to_question(sudoku_text):
  assert(len(sudoku_text) == 81)
  return re.sub('[^1-9]', '0', sudoku_text)

def items_to_questions(items):
  questions = []
  for item in items:
    sudoku_text = item['text']
    question = text_to_question(sudoku_text)
    crc = item['crc']
    qid = encode_crc(crc)
    level = item['level']
    question = '%s@%s@%s@%s' % (SUDOKU_VERSION, question, level, qid)
    questions.append(question)
  return questions

def fetch_questions(level, count):
  if count <= 0:
    return []
  start_crc = make_random_crc()
  query = {'level': level, 'crc': {'$gt': start_crc}}  
  items = _fetch_items(query, count)
  if len(items) == 0:
    query = {'level': level, 'crc': {'$lt': start_crc}}  
    items = _fetch_items(query, count)
  questions = items_to_questions(items)
  return questions

def first_fetch_questions(count):
  start_crc = make_random_crc()
  query = {'crc': {'$gt': start_crc}}  
  items = _fetch_items(query, count)
  if len(items) == 0:
    query = {'crc': {'$lt': start_crc}}  
    items = _fetch_items(query, count)
  questions = items_to_questions(items)
  return questions

def save_submit(uid, level, crc):
  user_table = get_user_table(client)
  user_table.create_index([('uid', pymongo.ASCENDING)])
  query = {'uid': uid}
  field_level = 'level_%s' % level
  setop = {'$inc': {field_level: 1, 'total': 1}, '$setOnInsert': {'uid': uid}}  
  user_table.update_one(query, setop, upsert=True)
  stat_table = get_stat_table(client)
  stat_table.create_index([('crc', pymongo.ASCENDING)])
  query = {'crc': crc}
  setop = {'$inc': {'total': 1}, '$setOnInsert': {'crc': crc}}
  stat_table.update_one(query, setop, upsert=True)

@app.get('/')
async def home(req: Request):
  questions = first_fetch_questions(MAX_COUNT)
  return templates.TemplateResponse("index.html", context={'request': req, 'questions': questions})

class Init(BaseModel):
  uid:   int # 用户标识
  level: int # 难度等级
  count: int # 返回新题目的数量

@app.get('/health')
async def health(req: Request):
  return {'status': 200}

@app.post('/init')
async def handle_init(params: Init):
  uid   = format_uid(params.uid)
  if uid is None:
    uid = make_random_uid()
  level = format_level(params.level)
  count = format_count(params.count)
  questions = fetch_questions(level, count)
  return {'status': 1, 'uid': uid, 'questions': questions, 'count': len(questions)}
  
@app.post('/fetch')
async def handle_fetch(params: Init):
  uid    = format_uid(params.uid)
  if uid is None:
    return {'status': 0, 'errmsg': 'Invalid user!'}
  level  = format_level(params.level)
  count  = format_count(params.count)
  questions = fetch_questions(level, count)
  return {'status': 1, 'level': level, 'questions': questions, 'count': len(questions)}

class Submit(BaseModel):
  level:  int # 难度等级
  qid:    int # 题目编号
  answer: str # 答案
  uid:    int # 用户标识
  count:  int # 返回新问题数量

@app.post('/submit')
async def handle_submit(params: Submit):
  level  = format_level(params.level)
  count  = format_count(params.count)
  uid    = format_uid(params.uid)
  if uid is None:
    return {'status': 0, 'errmsg': 'Invalid user!'}
  qid = format_qid(params.qid)
  if qid is None:
    return {'status': 0, 'errmsg': 'Invalid question!'}
  answer = format_answer(params.answer)
  if answer is None:
    return {'status': 0, 'errmsg': 'Invalid answer! qid: %s' % qid}
  test_crc = make_crc32(answer)
  real_crc = decode_crc(qid)
  if test_crc != real_crc:
    return {'status': 0, 'errmsg': 'answer is error! qid: %s' % qid}
  save_submit(uid, level, real_crc)
  questions = fetch_questions(level, count)
  return {'status': 1, 'level': level, 'questions': questions, 'count': len(questions)}

def main():
  uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', '5000')))
  print('game over!')

if __name__ == '__main__':
  main()
