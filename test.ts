const getRandomInt = (min, max) => {
    if (min == max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getSample = (array) => array[getRandomInt(0, array.length -1)];

class Game {
  constructor(counts, value, duration) {
    this.counts = counts;
    this.value = value;
    this.duration = duration;
    this.possibleValues = this.getPossibleValues();
  }
  
  getPossibleValues(totalVal = this.value, values = []) {
    const counts = this.counts;
    let possibleValues = [];
    if (values.length === counts.length - 1) {
      let v = totalVal / counts[counts.length-1];
      let valuesCopy = [...values];
      valuesCopy[counts.length - 1] = ~~v;
      return ~~v == v ? [valuesCopy] : [];
    } 
    const count = counts[values.length];
    const maxValue = ~~(totalVal/count);
    for (let i = 0; i <= maxValue; i++) {
      let valuesCopy = [...values];
      valuesCopy[values.length] = i;
      possibleValues = possibleValues.concat(this.getPossibleValues(totalVal-i*count, valuesCopy));
    }
    return possibleValues;
  }
  
  setPlayers(v1,v2) {
    this.p1 = new Player(true, v1, this);
    this.p2 = new Player(false, v2, this);
  }
}

const generatePlayer = (game) => {
  const totalVal = game.value;
  const possibleValues = game.possibleValues;
  return getSample(possibleValues);
};

class Player {
  constructor(me, values, game) {
    this.game = game;
    this.me = me;
    this.values = values;
  }
  
  getMetrics(o = []) {
    const own = this.game.counts.map((c,i) => c - (o[i] || 0));
    const ownValue = own.reduce((mem,c,i) => mem + c * this.values[i], 0);
    let eValue = 0;
    let max = 0;
    let min = this.game.value
    this.game.possibleValues.forEach((values => {
      const total = o.reduce((mem,c,i) => mem + c * values[i], 0);
      console.log(values, total)
      max = Math.max(max, total);
      min = Math.min(min, total);
      eValue += total
    }));
    eValue /= this.game.possibleValues.length;
    console.log({own,ownValue, values: this.values, eValue, max, min});
  }
  
  offer(o) {
    if (o !== undefined) {
      this.getMetrics(o);
    }
  }
}

const game = new Game([1,2,3],8,5);

game.setPlayers(generatePlayer(game), generatePlayer(game));
game.p1.offer([1,1,3]);