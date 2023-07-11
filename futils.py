# -*- coding: utf-8 -*-
import binascii, random, traceback
import pymongo

SUDOKU_VERSION      = 'v3'
DB_NAME             = 'sudoku'
SRC_TABLE_NAME      = 'v3'
USER_TABLE_NAME     = 'user'
STAT_TABLE_NAME     = 'stat'
MAX_COUNT           = 5               # 一次最多请求的数量
MAX_INT             = 4294967295      # 最大整数
SHIFT_BIT           = 13              # 编码CRC32相关算法需要用到的密钥
XOR_KEY             = 1184069411      # 编码CRC32相关算法需要用于的移位个数

def open_mongodb(conn_str):
  return pymongo.MongoClient(**conn_str) if type(conn_str) == dict else pymongo.MongoClient(conn_str)

def get_src_table(client, table_name=SRC_TABLE_NAME):
  return client[DB_NAME][table_name]

def get_user_table(client, table_name=USER_TABLE_NAME):
  return client[DB_NAME][table_name]

def get_stat_table(client, table_name=STAT_TABLE_NAME):
  return client[DB_NAME][table_name]

def format_uid(uid):
  return None if uid is None or type(uid) != int or uid <= 0 or uid >= MAX_INT else uid

def format_level(level):
  return level if level >= 1 and level <= 4 else 1

def format_count(count):
  return count if count >= 1 and count <= MAX_COUNT else 0

def format_answer(answer):
  return None if answer is None or len(answer) != 81 else answer

def format_qid(qid):
  return None if qid is None or type(qid) != int or qid < 0 else qid

def make_random_crc():
  return random.randint(1, MAX_INT-1)

def make_random_uid():
  return random.randint(1, MAX_INT-1)

def make_crc32(text):
  return binascii.crc32(text.encode('ascii'))

def encode_val(num, key, shift):
  # 将32位整数按位进行逆序排列
  num = ((num & 0x000000ff) << 24) | ((num & 0x0000ff00) << 8) | ((num & 0x00ff0000) >> 8) | ((num & 0xff000000) >> 24)
  # 对每个位进行异或运算
  num ^= key
  # 对每个位进行循环左移
  num = ((num << shift) & 0xffffffff) | (num >> (32 - shift))
  return num

def decode_val(num, key, shift):
  # 对每个位进行循环右移
  num = ((num >> shift) & 0xffffffff) | (num << (32 - shift))
  # 对每个位进行异或运算
  num ^= key
  # 将32位整数按位进行逆序排列
  num = ((num & 0x000000ff) << 24) | ((num & 0x0000ff00) << 8) | ((num & 0x00ff0000) >> 8) | ((num & 0xff000000) >> 24)
  return num

def encode_crc(crc):
  return encode_val(crc, XOR_KEY, SHIFT_BIT)

def decode_crc(crc):
  return decode_val(crc, XOR_KEY, SHIFT_BIT)

def get_last_except():
  return traceback.format_exc(limit=None, chain=True).splitlines()[-1]
