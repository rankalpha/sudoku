const NONE = undefined;
const LEVEL_EASY = 1;
const LEVEL_MEDIUM = 2;
const LEVEL_HARD = 3;
const LEVEL_VERYHARD = 4;
const STATE_EMPTY = 0;
const STATE_PLAIN = 1;
const STATE_GUESS = 2;
const TIMER_STATE_IDLE = 0;
const TIMER_STATE_START = 1;
const TIMER_STATE_STOP = 2;
const SUDOKU_VERSION = 'v3';
const MIN_BANK_COUNT = 3;
const MAX_BANK_COUNT = 15;
const MAX_REQ_COUNT = 5;
const DEBUG = 1;
const INFO = 2;
const ERROR = 4;
const MASK = 5;

function console_log(mode, info) {
  if (mode & MASK) {
    console.log(info);
  }
}

function init_context_state() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
}

function get_box_range(uid) {
  var row = Math.floor(uid / 9);
  var col = uid % 9;
  var ri = Math.floor(row / 3);
  var ci = Math.floor(col / 3);
  var rbeg = ri * 3;
  var rend = (ri + 1) * 3;
  var cbeg = ci * 3;
  var cend = (ci + 1) * 3;
  return { 'rbeg': rbeg, 'rend': rend, 'cbeg': cbeg, 'cend': cend };
}

function is_valid_game_text(text) {
  if (text) {
    var items = text.split('@')
    var count = items.length;
    if (count >= 4 && items[1].length == 81) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

function split_game_text(game_text) {
  var items = game_text.split('@');
  return { 'question': items[1], 'level': items[2], 'qid': items[3] };
}

function parse_game_text(game_text) {
  var items = game_text.split('@');
  console.assert(items.length >= 2);
  return items[1];
}

function parse_game_qid(game_text) {
  var items = game_text.split('@');
  console.assert(items.length >= 4);
  return items[3];
}

function make_new_game_text(version, sudoku_text, level, qid) {
  return `${version}@${sudoku_text}@${level}@${qid}`;
}

var _LEVEL_TO_MAIN_IDCLASS = {
  1: '.easyWin', 2: '.mediumWin', 3: '.hardWin', 4: '.veryhardWin'
}

var _LEVEL_TO_NAME = {
  1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Very Hard'
}

var _Plain2Val = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9 }
var _Guess2Val = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8, 'I': 9 }
var _Val2Guess = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I' }
var _Val2Cipher = { 1: 'j', 2: 'k', 3: 'l', 4: 'm', 5: 'n', 6: 'o', 7: 'p', 8: 'q', 9: 'r' }
var _Cipher2Val = { 'j': 1, 'k': 2, 'l': 3, 'm': 4, 'n': 5, 'o': 6, 'p': 7, 'q': 8, 'r': 9 }

function plain2val(ch) {
  return _Plain2Val[ch] || 0;
}

function guess2val(ch) {
  return _Guess2Val[ch] || 0;
}

function cipher2val(ch) {
  return _Cipher2Val[ch] || 0;
}

function val2guess(val) {
  console.assert(val >= 0 && val <= 9);
  return _Val2Guess[val];
}

function val2cipher(val) {
  console.assert(val >= 0 && val <= 9);
  return _Val2Cipher[val];
}

function msecs_to_text(msecs) {
  // 计算小时、分钟、秒数
  var hours = Math.floor(msecs / (1000 * 60 * 60));
  var minutes = Math.floor((msecs % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((msecs % (1000 * 60)) / 1000);

  // 将结果转换为 00:00:00 格式的字符串
  var result = ('0' + hours).slice(-2) + ':' +
    ('0' + minutes).slice(-2) + ':' +
    ('0' + seconds).slice(-2);

  return result;
}

function calc_time_delta(startDate, endDate) {
  // 计算时间差，单位为毫秒
  var diff = endDate.getTime() - startDate.getTime();
  return diff;
}

function timeDiff(startDate, endDate) {
  return msecs_to_text(calc_time_delta(startDate, endDate));
}

function get_uid() {
  var uidstr = $.cookie('uid');
  var uid = 0;
  if (uidstr === undefined) {
    uid = 0;
  } else {
    uid = parseInt(uidstr);
  }
  return uid;
}

function save_uid(uid) {
  $.cookie('uid', uid.toString(), { expires: new Date('2038-01-01') });
}

function get_level(default_level = 1) {
  var levelstr = $.cookie('level');
  var level = default_level;
  if (levelstr === undefined) {
    level = default_level;
  } else {
    level = parseInt(levelstr);
    if (level <= 0 || level > 4) {
      level = default_level;
    }
  }
  return level;
}

function save_level(level) {
  $.cookie('level', level.toString(), { expires: new Date('2038-01-01') });
}

class ConflictTimer {
  constructor(app, interval) {
    this.app = app;
    this.interval = interval;
    this.params = {};
    this.state = TIMER_STATE_IDLE;
  }

  reset() {
    this.stop();
  }

  start(params) {
    this.params = params;
    this.stop();
    this.state = TIMER_STATE_START;
    setTimeout(this.on_timer.bind(this), 0);
  }

  on_timer() {
    if (this.handle_task()) {
      setTimeout(this.on_timer.bind(this), this.interval);
    } else {
      this.stop();
    }
  }

  stop() {
    if ('click_uid' in this.params) {
      this.draw_conflict_warning(false);
    }
    this.state = TIMER_STATE_IDLE;
  }

  handle_task() {
    if (this.params['warning_time'] <= 0) {
      return false;
    }
    this.params['warning_time'] -= 1;
    this.draw_conflict_warning(this.params['warning_time'] % 2);
    return true;
  }

  draw_conflict_warning(enable) {
    this.app.board.draw_hot_rect(this.params['click_uid'], enable);
    for (var i = 0; i < this.params['conflict_uids'].length; i++) {
      var uid = this.params['conflict_uids'][i];
      this.app.board.draw_conflict_cell(uid, enable);
    }
  }
}

class SudokuContext {
  constructor(app) {
    this.app = app;
    this.win_count = 0;
    this.reset();
  }

  reset() {
    this._state = init_context_state();
    this.last_hot_num = 0;
    this.last_hot_tip = NONE;
    this._remove_mode = false;
    this._count = 0;
    this._commands = [];
    this._mark = NONE;
  }

  set_last_hot_num(num, enable) {
    var last_hot_num = this.last_hot_num;
    if (enable) {
      this.last_hot_num = num;
      this.last_hot_tip = num - 1;
      this._remove_mode = false;
    } else {
      this.last_hot_num = 0;
      this.last_hot_tip = NONE;
      this._remove_mode = false;
    }
    return last_hot_num;
  }

  is_remove_mode() {
    return this._remove_mode;
  }

  set_last_hot_tip(uid) {
    var last_hot_tip = this.last_hot_tip;
    this.last_hot_tip = uid;
    this._remove_mode = false;
    if (uid == NONE) {
      this.last_hot_num = 0;
    } else if (uid >= 0 && uid <= 8) {
      this.last_hot_num = uid + 1;
    } else if (uid == 9) {
      this._remove_mode = true;
      this.last_hot_num = 0;
    } else {
      this.last_hot_num = 0;
    }
    return last_hot_tip;
  }

  inc_plain(num) {
    this.inc_guess(num);
  }

  dec_guess(num) {
    this._count -= 1;
    console.assert(this._count >= 0);
    this._state[num] -= 1;
    console.assert(this._state[num] >= 0);
    //if (num == 9) {
    //  console.log("guess[9]: %d -" % this._state[num])
    //}
  }

  inc_guess(num) {
    this._count += 1;
    console.assert(this._count <= 81);
    if (this._count == 81) {
      this._win_count += 1;
    }
    this._state[num] += 1;
    console.assert(this._state[num] <= 9);
    //if (num == 9) {
    //  console.log("guess[9]: %d +" % this._state[num])
    //}
  }

  is_complete() {
    return this._count == 81;
  }

  is_guess_complete(num) {
    return this._state[num] == 9;
  }

  add_command(uid, cmd, params) {
    this._commands.push({ 'uid': uid, 'cmd': cmd, 'params': params });
  }

  mark() {
    this._mark = this._commands.length;
  }

  unmark() {
    if (this._mark == NONE) {
      return;
    }
    while (this._commands.length > this._mark) {
      this.undo_command();
    }
    this._mark = NONE;
  }

  undo() {
    if (this._commands.length > 0) {
      this.undo_command();
      if (this._mark !== NONE && this._commands.length <= this._mark) {
        this._mark = NONE;
      }
    }
  }

  undo_command() {
    console.assert(this._commands.length > 0)
    var command = this._commands.pop();
    var uid = command.uid;
    var cmd = command.cmd;
    var params = command.params;
    if (cmd == "+") {
      this.app.remove_cell(uid, false);
    } else if (cmd == "-") {
      this.app.insert_cell(uid, params, false);
    } else {
      console.assert(cmd == "//");
      this.app.remove_cell(uid, false);
      this.app.insert_cell(uid, params.src_num, false);
    }
  }
}

class SudokuCell {
  constructor(context, uid) {
    this.context = context;
    this.uid = uid;
    this.num = NONE;
    this.state = STATE_EMPTY;
  }

  is_plain() {
    return this.state == STATE_PLAIN;
  }

  is_guess() {
    return this.state == STATE_GUESS;
  }

  is_empty() {
    return this.state == STATE_EMPTY;
  }

  set_plain_num(num) {
    console.assert(this.num == NONE && this.state == STATE_EMPTY);
    this.num = num;
    this.state = STATE_PLAIN;
    this.context.inc_plain(num);
  }

  set_guess_num(num, is_record) {
    console.assert(this.state != STATE_PLAIN);
    var last_num = this.num;
    if (last_num !== NONE) {
      this.context.dec_guess(last_num);
      if (is_record) {
        this.context.add_command(this.uid, "//", (last_num, num));
      }
    } else {
      if (is_record) {
        this.context.add_command(this.uid, "+", num);
      }
    }
    this.num = num;
    this.state = STATE_GUESS;
    this.context.inc_guess(num);
    return last_num;
  }

  del_guess_num(is_record) {
    console.assert(this.state == STATE_GUESS);
    console.assert(this.num !== NONE)
    var last_num = this.num;
    this.context.dec_guess(last_num);
    if (is_record) {
      this.context.add_command(this.uid, "-", last_num);
    }
    this.num = NONE;
    this.state = STATE_EMPTY;
    return last_num;
  }

  clear() {
    this.num = NONE;
    this.state = STATE_EMPTY;
  }
}

class SudokuTable {
  constructor(app) {
    this.app = app;
    this.context = app.context;
    this._cells = new Array(81);
    for (var uid = 0; uid < 81; uid++) {
      this._cells[uid] = new SudokuCell(this.app.context, uid);
    }
  }

  reset() {
    //this.app.load_game(this.app.game_text, this.app.game_level);
  }

  import_game_text(game_text) {
    this.context.reset();
    var sudoku_text = parse_game_text(game_text);
    console.assert(sudoku_text.length == 81);
    for (var uid = 0; uid < sudoku_text.length; uid++) {
      var ch = sudoku_text[uid];
      var plain_num = plain2val(ch);
      var guess_num = guess2val(ch);
      this._cells[uid].clear();
      if (plain_num >= 1 && plain_num <= 9) {
        this._cells[uid].set_plain_num(plain_num);
      } else if (guess_num >= 1 && guess_num <= 9) {
        this._cells[uid].set_guess_num(guess_num, false);
      }
    }
  }

  make_sudoku_result(is_complete = false) {
    var sudoku_text = "";
    for (var uid = 0; uid < 81; uid++) {
      var cell = this._cells[uid];
      if (cell.is_guess()) {
        if (is_complete) {
          sudoku_text += val2cipher(cell.num);
        } else {
          sudoku_text += val2guess(cell.num);
        }
      } else if (cell.is_plain()) {
        sudoku_text += cell.num.toString(); // val2plain(cell.num)
      } else {
        sudoku_text += '0';
      }
    }
    return sudoku_text;
  }

  export_game_text() {
    var sudoku_text = this.make_sudoku_result(false);
    var qid = parse_game_qid(this.app.game_text)
    var game_text = make_new_game_text(SUDOKU_VERSION, sudoku_text, this.app.game_level, qid);
    return game_text;
  }

  set_guess_num(uid, num, is_record) {
    var cell = this._cells[uid];
    return cell.set_guess_num(num, is_record);
  }

  del_guess_num(uid, is_record) {
    var num = NONE;
    var cell = this._cells[uid];
    if (cell.is_guess()) {
      num = cell.del_guess_num(is_record);
    }
    return num;
  }

  cells() {
    var cells = [];
    for (var uid = 0; uid < 81; uid++) {
      var cell = this._cells[uid];
      cells.push({ 'uid': uid, 'state': cell.state, 'num': cell.num });
    }
    return cells;
  }

  get(uid) {
    console.assert(uid >= 0 && uid <= 80);
    var cell = this._cells[uid];
    return { 'state': cell.state, 'num': cell.num };
  }

  find_cells_by_num(hot_num) {
    var cells = [];
    for (var uid = 0; uid < 81; uid++) {
      var cell = this._cells[uid];
      if (cell.num == hot_num) {
        cells.push({ 'uid': uid, 'state': cell.state, 'num': cell.num });
      }
    }
    return cells;
  }

  get_conflict_uids(uid, num) {
    var conflict_uids = [];
    conflict_uids.push(...this.get_conflict_row(uid, num));
    conflict_uids.push(...this.get_conflict_col(uid, num));
    conflict_uids.push(...this.get_conflict_box(uid, num));
    var unique_uids = Array.from(new Set(conflict_uids));
    var sorted_uids = unique_uids.sort();
    return sorted_uids;
  }

  has_conflict(uid, test_uid, num) {
    if (test_uid == uid) {
      return false;
    }
    var cell = this._cells[test_uid];
    if (cell.is_empty()) {
      return false;
    }
    return cell.num == num;
  }

  get_conflict_row(uid, num) {
    var conflict_uids = [];
    var row = Math.floor(uid / 9);
    for (var col = 0; col < 9; col++) {
      var test_uid = row * 9 + col;
      if (this.has_conflict(uid, test_uid, num)) {
        conflict_uids.push(test_uid);
      }
    }
    return conflict_uids;
  }

  get_conflict_col(uid, num) {
    var conflict_uids = [];
    var col = uid % 9;
    for (var row = 0; row < 9; row++) {
      var test_uid = row * 9 + col;
      if (this.has_conflict(uid, test_uid, num)) {
        conflict_uids.push(test_uid);
      }
    }
    return conflict_uids;
  }

  get_conflict_box(uid, num) {
    var conflict_uids = [];
    var box = get_box_range(uid);
    for (var row = box.rbeg; row < box.rend; row++) {
      for (var col = box.cbeg; col < box.cend; col++) {
        var test_uid = row * 9 + col;
        if (this.has_conflict(uid, test_uid, num)) {
          conflict_uids.push(test_uid);
        }
      }
    }
    return conflict_uids;
  }
}

class SudokuBoard {
  constructor(app) {
    this.app = app;
    this.init_params();
  }

  reset() {
    this.restore_default_cursor();
  }

  flush() {
    var cells = this.app.table.cells();
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var uid = cell.uid;
      var state = cell.state;
      var num = cell.num;
      if (state == STATE_PLAIN) {
        this.draw_text(uid, num.toString(), STATE_PLAIN);
      } else if (state == STATE_GUESS) {
        this.draw_text(uid, num.toString(), STATE_GUESS);
      } else {
        this.draw_text(uid, "", STATE_EMPTY);
      }
    }
    for (var uid = 0; uid < 81; uid++) {
      this.draw_hot_rect(uid, false);
    }
    //this.flush_txt();
  }

  flush_txt() {
    this.app.ruler.init_context()
    this.app.ruler.parse()
    for (var uid = 0; uid < 81; uid++) {
      var slot = this.app.ruler.slots[uid];
      var cell = this.app.table.get(uid);
      var status = cell.status();
      var num = cell.num();
      for (var tid = 0; tid < 9; tid++) {
        if (tid < slot.nums.length) {
          if (slot.nums.length > 1) {
            text = slot.nums[tid].toString();
            status = "1"
          } else if (status == STATE_EMPTY) {
            text = slot.nums[0].toString();
            status = "2";
          } else {
            text = "*";
            status = "0";
          }
        } else {
          text = "*";
          status = "0";
        }
        this.draw_txt(uid, tid, text, status)
      }
    }
  }

  init_params() {
    this.plain_text_color = "black" // 明文文字的颜色
    this.guess_text_color = "#00BB00" // 推测文字的颜色
    this.txt_fg_color = "blue"  // 提示文字的前景色
    this.txt_wt_color = "red"   // 提示文字的警告色
    this.txt_bg_color = "white"   // 提示文字的背景色
  }

  cell_left_mouse_click(uid) {
    this.app.cell_left_mouse_click(uid);
  }

  cell_middle_mouse_click(uid) {
    this.app.cell_middle_mouse_click(uid);
  }

  cell_right_mouse_click(uid) {
    this.app.cell_right_mouse_click(uid);
  }

  draw_text(uid, text, status) {
    var color;
    if (status == STATE_PLAIN) {
      color = this.plain_text_color;
      $(`#${uid}`).find('.text').text(text).css('color', color).css('font-style', 'normal').removeClass('hide');
    } else if (status == STATE_GUESS) {
      color = this.guess_text_color;
      $(`#${uid}`).find('.text').text(text).css('color', color).css('font-style', 'italic').removeClass('hide');
    } else {
      $(`#${uid}`).find('.text').text(text).addClass('hide'); // 
    }
  }

  draw_hot_rect(uid, enable) {
    if (enable) {
      $(`#${uid}`).find('.circle').removeClass('hide');
    } else {
      $(`#${uid}`).find('.circle').addClass('hide');
    }
  }

  draw_txt(uid, tid, text, status) {
    //font = ("Arial", this.txt_size)
    var new_uid = this.txts[uid][tid];
    if (status == "2") {
      $(`#${new_uid}`).find('.text').css('color', this.txt_wt_color);
    } else if (status == "1") {
      $(`#${new_uid}`).find('.text').css('color', this.txt_fg_color);
    } else {
      $(`#${new_uid}`).find('.text').addClass('hide');
    }
  }

  draw_conflict_cell(uid, enable) {
    if (enable) {
      $(`#${uid}`).find('.warning').removeClass('hide');
    } else {
      $(`#${uid}`).find('.warning').addClass('hide');
    }
  }

  change_cursor(num) {
    $('.board').css('cursor', $(`.cursor${num}`).css('cursor'));
  }

  restore_default_cursor() {
    $('.board').css('cursor', '');
  }
}

class SudokuTips {
  constructor(app) {
    this.app = app;
    this.context = app.context;
  }

  set_unselect_state(uid) {
    var num = uid + 1;
    if (uid >= 0 && uid <= 8 && this.app.context.is_guess_complete(num)) {
      var btn = $(`#num${num}`);
      btn.removeClass('select').addClass('complete');
    } else {
      var btn = $(`#num${num}`);
      btn.removeClass('select').removeClass('complete');
    }
  }

  set_select_state(uid) {
    var num = uid + 1;
    if (uid >= 0 && uid <= 8 && this.app.context.is_guess_complete(num)) {
      var btn = $(`#num${num}`);
      btn.addClass('select').addClass('complete');
    } else {
      var btn = $(`#num${num}`);
      btn.addClass('select').removeClass('complete');
    }
  }

  button_click(uid) {
    if (this.app.is_stop_game) {
      return;
    }
    var last_uid = this.context.set_last_hot_tip(uid);
    if (last_uid !== NONE) {
      this.set_unselect_state(last_uid);
    }
    this.set_select_state(uid);
    if (last_uid == uid) {
      return;
    }
    if (last_uid !== NONE && last_uid >= 0 && last_uid <= 8) {
      this.app.select_hot_num(last_uid + 1, false);
    }
    if (uid >= 0 && uid <= 8) {
      this.app.select_hot_num(uid + 1, true);
      this.app.board.change_cursor(uid + 1);
    } else if (uid == 9) {
      console.assert(this.app.context.is_remove_mode());
      this.app.board.change_cursor(0);
    } else {
      this.app.board.restore_default_cursor();
    }
  }

  clear() {
    //var last_uid = this.context.set_last_hot_tip(NONE);
    //if (last_uid !== NONE) {
    //  this.set_unselect_state(last_uid)
    this.flush();
  }

  flush() {
    for (var uid = 0; uid < 9; uid++) {
      this.update_state(uid);
    }
  }

  update_state(uid) {
    if (uid == this.context.last_hot_tip) {
      this.set_select_state(uid);
    } else {
      this.set_unselect_state(uid);
    }
  }
}

class SudokuTools {
  constructor(app) {
    this.app = app;
  }

  button_mark_click() {
    if (this.app.is_stop_game) {
      return;
    }
    this.app.is_new_game = false;
    this.app.context.mark();
  }

  button_unmark_click() {
    if (this.app.is_stop_game) {
      return;
    }
    this.app.is_new_game = false;
    this.app.context.unmark();
  }

  button_undo_click() {
    if (this.app.is_stop_game) {
      return;
    }
    this.app.is_new_game = false;
    this.app.context.undo();
  }

  button_restart_click() {
    if (this.app.is_stop_game) {
      return;
    }
    this.app.is_new_game = false;
    this.app.restart_game();
  }

  button_load_click() {
    if (this.app.is_stop_game) {
      return;
    }
    this.app.is_new_game = false;
    this.app.load_game_from_cookie()
  }

  button_save_click() {
    if (this.app.is_stop_game) {
      return;
    }
    this.app.is_new_game = false;
    this.app.save_game_to_cookie()
  }

  button_easy_click() {
    this.app.start_game(LEVEL_EASY);
  }

  button_medium_click() {
    this.app.start_game(LEVEL_MEDIUM);
  }

  button_hard_click() {
    this.app.start_game(LEVEL_HARD);
  }

  button_veryhard_click() {
    this.app.start_game(LEVEL_VERYHARD);
  }

  reset() {
  }
}

class SudokuBank {
  constructor(app) {
    this.app = app;
    this.init_context();
  }

  init_context() {
    this.tid = NONE;
    this.last_ri = -1;
    this._bank = [[], [], [], [], []];
  }

  remove_game(level, game_text) {
    var index = this._bank[level].indexOf(game_text);
    if (index !== -1) {
      this._bank[level].splice(index, 1);
    }
  }

  print_error(xhr, textStatus, error) {
    console_log(ERROR, "请求失败，错误信息为：" + error);
  }

  post_request(url, params, success_func, error_func = this.print_error) {
    $.ajax({
      url: url,
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(params),
      async: true, // 设置为异步请求
      success: (jobj) => success_func(jobj),
      error: (xhr, textStatus, error) => error_func(xhr, textStatus, error)
    });
  }

  post_init_request(game_level, count) {
    var uid = get_uid();
    var params = { 'uid': uid, 'level': game_level, 'count': count };
    const handle_init_response = (jobj) => {
      if (jobj.status != 1 || jobj.count <= 0 || jobj.questions == undefined) {
        console_log(ERROR, 'init failed!' + jobj.errmsg);
        return;
      }
      save_uid(jobj.uid);
      this._bank[game_level] = this._bank[game_level].concat(jobj.questions);
    }
    this.post_request('/init', params, handle_init_response);
  }

  post_fetch_request(game_level, count, cbfunc) {
    var uid = get_uid();
    var params = { 'uid': uid, 'level': game_level, 'count': count };
    const handle_fetch_response = (jobj) => {
      if (jobj.status != 1 || jobj.count <= 0 || jobj.questions == undefined) {
        console_log(ERROR, 'fetch failed! errmsg: ' + jobj.errmsg);
        return;
      }
      this._bank[jobj.level] = this._bank[jobj.level].concat(jobj.questions);
      if (cbfunc) {
        cbfunc(game_level, count);
      }
    }
    this.post_request('/fetch', params, handle_fetch_response);
  }

  post_submit_request(qid, sudoku_text, game_level, count, is_auto_load) {
    var uid = get_uid();
    var params = { 'level': game_level, 'qid': qid, 'answer': sudoku_text, 'uid': uid, 'count': count };
    const handle_submit_response = (jobj) => {
      if (jobj.status != 1) {
        console_log(ERROR, 'submit failed! errmsg: ' + jobj.errmsg);
        return;
      }
      if (jobj.count <= 0 || jobj.questions == undefined) {
        return;
      }
      this._bank[jobj.level] = this._bank[jobj.level].concat(jobj.questions);
      if (is_auto_load) {
        this.load_new_game(game_level);
      }
    }
    this.post_request('/submit', params, handle_submit_response);
  }

  init() {
    var level = get_level();
    console.assert(level >= 1 && level <= 4);
    this.post_init_request(level, MAX_REQ_COUNT);
  }

  submit_result(game_level, game_text, sudoku_text) {
    var qid = parse_game_qid(game_text);
    var count = this.calc_question_count(game_level);
    this.post_submit_request(qid, sudoku_text, game_level, count, false);
  }

  fetch_new_game(game_level) {
    var count = this.calc_question_count(game_level);
    const cbfunc = (game_level, count) => {
      this.load_new_game(game_level);
    }
    this.post_fetch_request(game_level, count, cbfunc);
  }

  balance_game(game_level) {
    if (this.is_balance) {
      return;
    }
    this.is_balance = true;
    var count = this.calc_balance_count(game_level);
    if (count > 0) {
      const cbfunc = (game_level, count) => {
        this.is_balance = false;
      }
      this.post_fetch_request(game_level, count, cbfunc);
    }
  }

  add_game_text(game_text) {
    if (!is_valid_game_text(game_text)) {
      return NONE;
    }
    var item = split_game_text(game_text);
    this._bank[item.level].push(game_text);
    return item.level;
  }

  calc_balance_count(game_level) {
    var count = MIN_BANK_COUNT - this._bank[game_level].length;
    if (count > 0) {
      return MAX_REQ_COUNT;
    } else {
      return 0;
    }
  }

  calc_question_count(game_level) {
    var count = MAX_BANK_COUNT - this._bank[game_level].length;
    if (count > MAX_REQ_COUNT) {
      return MAX_REQ_COUNT;
    } else if (count <= 0) {
      return 0;
    } else {
      return count;
    }
  }

  load_new_game(game_level) {
    if (this.app.is_stop_game || !this.app.is_new_game) {
      this.remove_game(this.app.game_level, this.app.game_text);
    }
    var game_text = this.select_game_text(game_level);
    if (game_text == NONE) {
      return false;
    }
    this.app.load_game(game_text, game_level);
    return true;
  }

  select_game_text(game_level) {
    var count = this._bank[game_level].length;
    if (count > 0) {
      var ri = 0;
      for (var i = 0; i < count; i++) {
        ri = Math.floor(Math.random() * count);
        if (ri != this.last_ri) {
          break;
        }
      }
      this.last_ri = ri;
      return this._bank[game_level][ri];
    }
    return NONE;
  }
}

class SudokuApp {
  constructor() {
    this.is_stop_game = true;
    this.is_new_game = true;
    this.gameStartDate = NONE;
    this.onlineStartDate = NONE;
    this.totalMsecs = 0;
    this.winCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.context = new SudokuContext(this);
    this.table = new SudokuTable(this);
    this.board = new SudokuBoard(this);
    this.tips = new SudokuTips(this);
    this.tools = new SudokuTools(this);
    this.bank = new SudokuBank(this);
    this.game_level = 4;
    this.game_text = NONE; //this.bank.get_game_text(this.game_level);
    this.conflict_timer = new ConflictTimer(this, 400);
    this.reset();
    //this.bank.start_timer();
    //this.load_game(this.game_text, this.game_level);
  }

  reset() {
    this.context.reset();
    this.table.reset();
    this.conflict_timer.reset()
    this.board.reset();
    this.board.flush();
    this.tools.reset();
    this.tips.clear();
    //this.conflict_timer.stop();
  }

  restart_game() {
    if (is_valid_game_text(this.game_text)) {
      this.load_game(this.game_text, this.game_level);
    }
  }

  load_game(game_text, game_level) {
    if (!is_valid_game_text(game_text)) {
      console_log(ERROR, `invalid_game_text: ${game_text}`)
      return
    }
    if (game_level < 1 || game_level > 4) {
      console_log(ERROR, `invalid level ${game_level}`)
    }
    this.game_level = game_level;
    this.game_text = game_text;
    this.table.import_game_text(game_text);
    this.board.flush();
    this.update_start_info();
  }

  update_start_info() {
    save_level(this.game_level);
    var endDate = new Date();
    if (!this.is_stop_game && this.gameStartDate) {
      var delta = calc_time_delta(this.gameStartDate, endDate);
      this.totalMsecs += delta;
    }
    this.gameStartDate = endDate;
    if (!this.onlineStartDate) {
      this.onlineStartDate = endDate;
    }
    var name = _LEVEL_TO_NAME[this.game_level] || 'Unknown';
    $('.Level').text(name);
    $('.welcome').removeClass('float_aniX');
    $('.bingo').addClass('hide');
    $('.gamebtn').removeClass('disable');
    $('.num').removeClass('disable').removeClass('complete').removeClass('select');
    this.board.restore_default_cursor();
    this.is_stop_game = false;
    this.is_new_game = true;
  }

  load_game_from_cookie() {
    var game_text = $.cookie('game');
    var game_level = $.cookie('level');
    if (game_text) {
      this.load_game(game_text, game_level);
    } else {
      this.reset();
    }
  }

  save_game_to_cookie() {
    var game_text = this.table.export_game_text();
    $.cookie('game', game_text, { expires: 7, path: '/' });
    $.cookie('level', this.game_level, { expires: 7, path: '/' })
  }

  start_game(level) {
    if (this.bank.load_new_game(level)) {
      this.bank.balance_game(level);
    } else {
      this.bank.fetch_new_game(level);
    }
  }

  cell_left_mouse_click(uid) {
    console_log(INFO, `${uid} left_mouse_clicked!`);
    if (this.is_stop_game) {
      return;
    }
    var cell = this.table.get(uid);
    var state = cell.state;
    var num = cell.num;
    var last_hot_num = this.context.last_hot_num;
    if (state != STATE_EMPTY) {
      if (this.context.is_remove_mode()) {
        if (state == STATE_PLAIN) {
          this.change_select_num(num);
        } else {
          this.remove_cell(uid, true);
          //this.board.flush_txt();
        }
      } else if (num != last_hot_num) {
        this.change_select_num(num);
      }
    } else if (last_hot_num != 0) {
      var conflict_uids = this.table.get_conflict_uids(uid, last_hot_num);
      if (conflict_uids.length != 0) {
        //#console.log("%s: hot:%d" % (conflict_uids, this.last_hot_num))
        this.conflict_timer.start({ "warning_time": 7, "click_uid": uid, "conflict_uids": conflict_uids });
      } else {
        this.insert_cell(uid, last_hot_num, true);
        //this.board.flush_txt();
        if (this.context.is_complete()) {
          console_log(DEBUG, "game over!");
          this.update_end_info();
        }
      }
    }
  }

  update_end_info() {
    this.is_stop_game = true;
    var endDate = new Date();
    var delta = calc_time_delta(this.gameStartDate, endDate);
    this.totalMsecs += delta;
    this.winCount[this.game_level] += 1;
    var count = this.winCount[this.game_level];
    var idclass = _LEVEL_TO_MAIN_IDCLASS[this.game_level] || NONE;
    if (idclass) {
      $(idclass).text(`${count}`);
    }
    $('.welcome').addClass('float_aniX');
    $('.bingo').removeClass('hide');
    $('.gamebtn').addClass('disable');
    $('.num').addClass('disable');
    var sudoku_text = this.table.make_sudoku_result(true);
    this.bank.submit_result(this.game_level, this.game_text, sudoku_text);
  }

  cell_right_mouse_click(uid) {
    if (this.is_stop_game) {
      return;
    }
    this.remove_cell(uid, true);
  }

  update_select_num(last_num, num) {
    this.select_hot_num(last_num, false);
    this.select_hot_num(num, true);
    this.board.change_cursor(num);
  }

  change_select_num(num) {
    var last_hot_tip = this.context.last_hot_tip;
    if (last_hot_tip !== NONE) {
      this.tips.set_unselect_state(last_hot_tip);
    }
    var last_hot_num = this.context.set_last_hot_num(num, true);
    this.update_select_num(last_hot_num, num);
    this.tips.set_select_state(num - 1);
  }

  insert_cell(uid, num, is_record) {
    this.table.set_guess_num(uid, num, is_record);
    this.board.draw_text(uid, num.toString(), STATE_GUESS);
    var enable = this.context.last_hot_num == num ? true : falsee;
    this.board.draw_hot_rect(uid, enable);
    this.tips.update_state(num - 1);
    this.is_new_game = false;
  }

  remove_cell(uid, is_record) {
    var cell = this.table.get(uid);
    var state = cell.state;
    var num = cell.num;
    if (state != STATE_GUESS) {
      return;
    }
    num = this.table.del_guess_num(uid, is_record);
    this.board.draw_text(uid, "", STATE_EMPTY);
    this.board.draw_hot_rect(uid, false);
    if (num !== NONE) {
      this.tips.update_state(num - 1);
    }
    this.is_new_game = false;
  }

  select_hot_num(hot_num, enable) {
    var cells = this.table.find_cells_by_num(hot_num);
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      console.assert(cell.state != STATE_EMPTY && cell.num == hot_num);
      this.board.draw_hot_rect(cell.uid, enable);
    }
  }
}

class SudokuTimer {
  constructor(app) {
    this.app = app;
    this.tid = NONE;
  }

  start() {
    this.stop();
    this.on_update();
    this.tid = setInterval(this.on_update.bind(this), 1000);
  }

  stop() {
    if (this.tid) {
      clearInterval(this.tid);
      this.tid = NONE;
    }
  }

  on_update() {
    var endDate = new Date();
    if (this.app.onlineStartDate) {
      var text = timeDiff(this.app.onlineStartDate, endDate);
      $('#time').text(text);
    }
    if (!this.app.is_stop_game && this.app.gameStartDate) {
      var delta = calc_time_delta(this.app.gameStartDate, endDate);
      var text = msecs_to_text(delta);
      $('.CurrTime').text(text);
      var text = msecs_to_text(this.app.totalMsecs + delta);
      $('.TotalTime').text(text);
    }
  }
}

app = new SudokuApp();

$('.box').click(function (event) {
  var idstr = $(this).attr('id');
  var uid = parseInt(idstr);
  if (event.which == 1) {
    app.board.cell_left_mouse_click(uid);
  } else if (event.which == 2) {
    app.board.cell_middle_mouse_click(uid);
  }
});

$('.box').on('contextmenu', function (event) {
  var idstr = $(this).attr('id');
  var uid = parseInt(idstr);
  if (event.which == 3) {
    event.preventDefault();
    app.board.cell_right_mouse_click(uid);
  }
});

$('.num').click(function () {
  var idstr = $(this).attr('id');
  var num = parseInt(idstr.match(/\d+/)[0]);
  app.tips.button_click(num - 1);
});

$('.easy').click(function () {
  app.tools.button_easy_click();
});

$('.medium').click(function () {
  app.tools.button_medium_click();
});

$('.hard').click(function () {
  app.tools.button_hard_click();
});

$('.veryhard').click(function () {
  app.tools.button_veryhard_click();
});

$('.undo').click(function () {
  app.tools.button_undo_click();
});

$('.restart').click(function () {
  app.tools.button_restart_click();
});

$('.load').click(function () {
  app.tools.button_load_click();
});

$('.save').click(function () {
  app.tools.button_save_click();
});

timer = new SudokuTimer(app);
timer.start();

/**
document.addEventListener('click', function () {
  //  $('.warning').toggleClass('hide');
  //app.update_end_info();
  var game_level = 1;
  var game_text = 'v3@829lpo1nml6n8mj7krmpj5k9o8l1n4p9klo8pqk63mrj5r3o1nqm7k2rpmj58l6n18r63kmpom3kq759j@1@3191290070';
  var sudoku_text = '829lpo1nml6n8mj7krmpj5k9o8l1n4p9klo8pqk63mrj5r3o1nqm7k2rpmj58l6n18r63kmpom3kq759j';
  app.bank.submit_result(game_level, game_text, sudoku_text)
});
/**/

$(document).ready(function () {
  var questions = $('.question');  // 选中所有 class 为 question 的元素
  var game_level = 1;
  questions.each(function () {  // 遍历选中的元素列表
    var game_text = $(this).text();  // 获取当前元素的文本
    var level = app.bank.add_game_text(game_text);
    if (level != NONE) {
      game_level = level;
    }
  });
  app.bank.load_new_game(game_level);
  setTimeout(app.bank.init(), 3000);
});