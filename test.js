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
		this.totalCount = getTotalCount(this.counts);
		this.possibleValues = this.getPossibleValues();
		this.possibleOffers = this.getPossibleOffers();
	}

	getPossibleOffers(offer = [], i = 0) {
		let possibleOffers = [];
		let c = this.counts[i];
		if (i == this.counts.length) {
			return [offer];
		}
		for (let j = 0; j <= c; j++) {
			let offerCopy = [...offer];
			offerCopy[i] = j;
			possibleOffers = possibleOffers.concat(this.getPossibleOffers(offerCopy, i+1));
		}
		return possibleOffers;
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

	setPlayers(p1,p2, t) {
		this.p1 = t == 1 ? new Player(true, this, p1) : new Player(true, this, p1);
		this.p2 = t == 1 ? new Player(false, this, p2) : new Player(false, this, p2);
	}

	startGame() {
		let offer;
		//console.log(`game starts, p1: ${this.p1.values.join()}, p2: ${this.p2.values.join()}, `+
		//	`counts: ${this.counts.join()}, value: ${this.value}`);

		offer = this.p1.offer(offer, 0).o;

		for (let i = 0; i < this.duration; i++) {
			//console.log(`turn ${i + 1}`);
			for (let j = 1; j < 3; j++) {
				//offer && console.log(`offer by p${j}, offer: ${offer.join()}`);
				const p = j == 1 ? this.p2 : this.p1;
				const nextOffer = p.offer(offer, i + 1).o;
				if (!nextOffer) {
					return this.endGame(offer, j == 2);
				}
				offer = nextOffer;
			}
		}
		return this.endGame();
	}

	endGame(offer, isFirst) {
		const oppositeOffer = offer && getOppositeOffer(offer, this.counts);
		const totalByFirst = offer && getTotalValue(isFirst ? offer : oppositeOffer, this.p1.values);
		const totalBySecond = offer && getTotalValue(isFirst ? oppositeOffer : offer, this.p2.values);
		//offer && console.log('offer', totalByFirst, totalBySecond, offer)
		//console.log(`end of game. ${offer ? 'deal' : 'no deal'}`);
		//offer && console.log(`First value: ${totalByFirst}`);
		//offer && console.log(`Second value: ${totalBySecond}`);
		return offer ? [totalByFirst, totalBySecond] : null;
	}

}

const generatePlayer = (game) => {
const possibleValues = game.possibleValues;
return getSample(possibleValues);
};

const getTotalValue = (offer, values) => offer.reduce((mem,c,i) => mem + c * values[i], 0);
const getTotalCount = (counts) => counts.reduce((mem,c) => mem + c, 0);
const getOppositeOffer = (offer, counts) => counts.map((c,i) => c - (offer[i] || 0));

class Player {
	constructor(me, game, opt) {
		this.game = game;
		this.me = me;
		this.values = opt.values;

		this.p_opp = [];
		this.p_own = [];
		this.game.possibleValues.forEach((values, i) => {
			this.p_opp[i] = 1 / this.game.possibleValues.length;
			this.p_own[i] = 1 / this.game.possibleValues.length;
		});

		this.wFeatures = opt.wFeatures;
	}

	calcP_opp(o) {
		const {
			wList,
			totalWeight,
		} = this.rankValuesByOffer(o);
		let offerProbability = this.game.possibleValues.reduce((mem, values, i) => {
			return mem + this.p_opp[i] * wList[i]/totalWeight;
		}, 0);

		return this.game.possibleValues.map((values, i) => {
			return this.p_opp[i] * (wList[i]/totalWeight) / offerProbability;
		});
	}

	rankValuesByOffer(o) {
		let totalWeight = 0;
		let wList = this.game.possibleValues.map((values) => {
			const own = getOppositeOffer(o, this.game.counts);
			const ownValue = getTotalValue(own, values) / this.game.value;
			let w;
			if (!ownValue) {
				w = 0.001;
			}
			else if (ownValue < 0.4) {
				w = ownValue / this.wFeatures[2];
			}
			else if (ownValue < 0.6) {
				w = ownValue;
			}
			else if (ownValue < 0.8) {
				w = 1;
			}
			else {
				w = 1.8 - ownValue;
			}
			o.forEach((c, i) => {
				if (c == 0) {
					return;
				}
				let copyOwn = own.slice();
				copyOwn[i] = c - 1;
				const v = getTotalValue(copyOwn, values) / this.game.value;
				if (v == ownValue) {
					w = this.wFeatures[0] * w; // 0.5
				}
				else if (v + 1 == ownValue) {
					w = this.wFeatures[1] * w; // 0.8
				}
			});
			return w;
		});
		
		
		wList = wList.map(w => {
			totalWeight += w;
			return w;
		});

		return {
			wList,
			totalWeight,
		};
	}

	getMetrics(o = []) { // by opposite offer
		const opposite = getOppositeOffer(o, this.game.counts);
		const ownValue = getTotalValue(o, this.values);
		let eValue = 0;
		let max = 0;
		let min = this.game.value;
		this.game.possibleValues.forEach(((values,i) => {
			const total = getTotalValue(opposite, values);
			max = Math.max(max, total);
			min = Math.min(min, total);
			eValue += total * this.p_opp[i];
		}));

		let variance = 0;
		this.game.possibleValues.forEach(((values,i) => {
			const total = getTotalValue(opposite, values);
			variance += this.p_opp[i] * (total - eValue) * (total - eValue);
		}));
		variance = Math.sqrt(variance);
		const metrics = {
			ownValue,
			opposite,
			max,
			variance,
			eValue,
		};
		return metrics;
	}

	offer(o, turn) { // 0,1,2,3...duration - 1
		this.turn = turn;
		const isLastTurn = turn == this.game.duration;
		const isLastWordByOp = isLastTurn && !this.me;
		const isLastWordByMe = isLastTurn && this.me;
		
		if (o !== undefined) {
			this.p_opp = this.calcP_opp(o);
			const offerAssessment = this.game.possibleValues.reduce((mem, values, i) => {
				
				let w = this.p_opp[i] > 0.01 ? this.acceptOffer(this.values, o, values, isLastWordByMe || isLastWordByOp, isLastWordByOp) : 0;
				const oppP = this.findOpp();
				//isLastWordByMe && console.log(`for ${oppP.values.join()}/${values.join()}: p - ${this.p_opp[i].toFixed(2)} w - ${w.toFixed(2)} me: ${this.values.join()} offer: ${o.join()}`);
				return mem + w * this.p_opp[i];
			}, 0);
			
			if (isLastWordByMe || isLastWordByOp ? offerAssessment > this.wFeatures[3] : offerAssessment > this.wFeatures[4]) {
				return { o: undefined };
			}

		}
		let ownOffer = this.generateOffer(o);
		if (ownOffer) {
			//this.p_own = this.calcP_opp(ownOffer, this.p_own, this.p_opp, !this.me, !this.me ? turn + 1 : turn);
		}
		
		return { o: ownOffer };
	}

	acceptOffer(v_own, c_own, v_opp, lw, lo) { // lw - is last word, lo - is last offer. return from 1 (full accept) to 0 (totally reject)
		const c_opp = getOppositeOffer(c_own, this.game.counts);
		const ownValue = getTotalValue(c_own, v_own) / this.game.value;
		const oppValue = getTotalValue(c_opp, v_opp) / this.game.value;
		let offerWithMaxVal = {
			ownV: ownValue,
			oppV: oppValue,
		};
		this.game.possibleOffers.filter((oppC) => {
			const ownC = getOppositeOffer(oppC, this.game.counts);
			const ownV = getTotalValue(ownC, v_own) / this.game.value;
			const oppV = getTotalValue(oppC, v_opp) / this.game.value;
			if (ownV > ownValue && oppV >= oppValue && offerWithMaxVal.ownV < ownV) {
				offerWithMaxVal = { ownV, oppV, };
			}
		});

		let max = 0;
		let min = this.game.value;
		this.game.possibleValues.forEach(values => {
			const total = getTotalValue(c_opp, values);
			max = Math.max(max, total);
			min = Math.min(min, total);
		});

		if (max <= ownValue) {
			return 1;
		}

		if (ownValue >= this.wFeatures[5]) {
			return 1;
		}

		if (ownValue >= oppValue) {
			if (lw) {
				return ownValue >= 0.5 ? 1 : ownValue;
			}
			if (offerWithMaxVal.ownV > ownValue) {
				return Math.max(1 - 2 * (offerWithMaxVal.ownV - ownValue + offerWithMaxVal.oppV - oppValue), 0);
			}
			if (ownValue >= 0.5) {
				return Math.min(ownValue + (ownValue - oppValue), 1);
			}
		}
		if (ownValue >= 0.5) {
			if (lw) {
				if (oppValue - ownValue <= 0.4) {
					return Math.max(0, (this.wFeatures[6] - (oppValue - ownValue)));
				}
				else {
					return 0;
				}
			}
			else {
				return 0;
			}
		}

		if (lw) {
			if (oppValue - ownValue <= 0.4) {
				return Math.max(0, (this.wFeatures[7] - (oppValue - ownValue)));
			}
			else {
				return 0;
			}
		}
		else {
			return 0;
		}
	}

	findOpp() {
		return this.game.p1 == this ? this.game.p2 : this.game.p1;
	}

	filterPossibleOffers() {
		let possibleOffers = this.game.possibleOffers.filter((o) => {
			const ownValue = getTotalValue(o, this.values);

			return ownValue * 2 > this.game.value;
		});
		return possibleOffers;
	}

	getOfferWeight(c_own2, v_own, c_own1, v_opp, lw, lo) {
		const c_opp2 = getOppositeOffer(c_own2, this.game.counts);
		const ownValue = getTotalValue(c_own2, v_own) / this.game.value;
		const oppValue = getTotalValue(c_opp2, v_opp) / this.game.value;


		const ownOfferLWAssessment = this.acceptOffer(v_own, c_own2, v_opp, true, false);
		const ownOfferNotLWAssessment = this.acceptOffer(v_own, c_own2, v_opp, false, false);
		const ownTotalyAccept = ownOfferLWAssessment == 1;
		const ownPartAccept = ownOfferLWAssessment != 1 && ownOfferLWAssessment >= 0.5;
		const ownTotalyReject = ownOfferLWAssessment < 0.5;

		const oppOfferLWAssessment = this.acceptOffer(v_opp, c_opp2, v_own, true, false);
		const oppOfferNotLWAssessment = this.acceptOffer(v_opp, c_opp2, v_own, false, false);
		const oppTotalyAccept = oppOfferLWAssessment == 1;
		const oppPartAccept = oppOfferLWAssessment != 1 && oppOfferLWAssessment >= 0.5;
		const oppTotalyReject = oppOfferLWAssessment < 0.5;
		let w = 0;
		let k = this.wFeatures[8];

		if (ownTotalyAccept && oppTotalyAccept) {
			w = this.wFeatures[9] + ownValue + k * oppValue;
		}
		if (ownTotalyAccept && oppPartAccept) {
			w = this.wFeatures[10] + ownValue + k * oppValue;
		}
		if (ownPartAccept && oppTotalyAccept) {
			w = this.wFeatures[11] + ownValue + k * oppValue;
		}
		if (ownPartAccept && oppPartAccept) {
			w = this.wFeatures[12] + ownValue + k * oppValue;
		}
		if (ownTotalyAccept && oppTotalyReject) {
			w = this.wFeatures[13] + ownValue + k * oppValue;
		}
		if (ownTotalyReject && oppTotalyAccept) {
			w = 0 + ownValue + k * oppValue;
		}
		if (ownPartAccept && oppTotalyReject) {
			w = 1 + ownValue + k * oppValue;
		}
		if (ownTotalyReject && oppPartAccept) {
			w = 0 + ownValue + k * oppValue;
		}
		if (ownTotalyReject && oppTotalyReject) {
			w = 0;
		}

		if (ownOfferNotLWAssessment == 1) {
			//w += oppOfferNotLWAssessment == 1 ? 1 : 0.5;
		}
		else if (oppOfferNotLWAssessment == 1) {
		//	w -= 1;
		}
		return w;
	}

	generateOffer(c_own) {
		const isLastTurn = this.turn == this.game.duration;
		const isLastWordByOp = isLastTurn && !this.me;
		const isLastWordByMe = isLastTurn && this.me;

		let possibleOffers = this.filterPossibleOffers();

		let offersWithWeight = possibleOffers.map((c_own2) => {
			const w = this.game.possibleValues.reduce((mem, values, i) => {
				const offerW = this.p_opp[i] > 0.01 ? this.getOfferWeight(c_own2, this.values, c_own, values, isLastWordByMe, isLastWordByOp) : 0;
				return mem + offerW * this.p_opp[i];
			}, 0);
			return { w, o: getOppositeOffer(c_own2, this.game.counts), };
		});
		
		offersWithWeight.sort((a,b) => b.w - a.w);
		return offersWithWeight[0].o;
	}

	generateRandomOffer(offers) {
		return getSample(offers);
	}

}





class Player2 {
	constructor(me, game, opt) {
		this.game = game;
		this.me = me;
		this.values = opt.values;

		this.pOppositeValues = [];
		this.game.possibleValues.forEach((values, i) => {
			this.pOppositeValues[i] = 1/this.game.possibleValues.length;
		});
	}

	calcProbabilityByOfferCondition(o) {
		const {
			valuesWeight,
			totalWeight,
		} = this.rankValuesByOffer(o);

		let offerProbability = this.game.possibleValues.reduce((mem, values, i) => {
			return mem + this.pOppositeValues[i] * valuesWeight[i]/totalWeight;
		}, 0);

		this.pOppositeValues = this.game.possibleValues.map((values, i) => {
			//this.me && console.log(`pOppositex for values ${values.join()}: ${(this.pOppositeValues[i] * (valuesWeight[i]/totalWeight) / offerProbability).toFixed(3)}`)
			return this.pOppositeValues[i] * (valuesWeight[i]/totalWeight) / offerProbability;
		});
	}

	rankValuesByOffer(o) {
		const k = 0.5; // уменьшать с увеличением хода
		let totalWeight = 0;
		let maxErr = 0;
		let errors = this.game.possibleValues.map((values) => {
			const ownCounts = getOppositeOffer(o, this.game.counts);
			const ownValue = getTotalValue(ownCounts, values);
			const wByCount = this.game.value * Math.abs((k * this.game.totalCount - getTotalCount(ownCounts))) / this.game.totalCount;
			const err = wByCount/2 + (2*ownValue < this.game.value ? this.game.value : 2*this.game.value - ownValue)
			
			Math.abs(this.game.value - ownValue);
			maxErr = Math.max(maxErr, err);
			return err;
		});

		let valuesWeight = this.game.possibleValues.map((values,i) => {
			const w = 1.2 * maxErr - errors[i];
			totalWeight += w;
			return w;
		});

		return {
			valuesWeight,
			totalWeight,
		};
	}

	getMetrics(o = []) { // by opposite offer
		const opposite = getOppositeOffer(o, this.game.counts);
		const ownValue = getTotalValue(o, this.values);
		let eValue = 0;
		let max = 0;
		let min = this.game.value;
		this.game.possibleValues.forEach(((values,i) => {
			const total = getTotalValue(opposite, values);
			max = Math.max(max, total);
			min = Math.min(min, total);
			eValue += total * this.pOppositeValues[i];
		}));

		let variance = 0;
		this.game.possibleValues.forEach(((values,i) => {
			const total = getTotalValue(opposite, values);
			variance += this.pOppositeValues[i] * (total - eValue) * (total - eValue);
		}));
		variance = Math.sqrt(variance);
		const metrics = {
			opposite,
			ownValue,
			values: this.values,
			eValue,
			max,
			min,
			variance,
		};
		return metrics;
	}

	offer(o, turn) { // 0,1,2,3...duration - 1
		this.turn = turn;
		const isLastTurn = turn == this.game.duration;
		const isLastWordByOp = isLastTurn && !this.me;
		const isLastWordByMe = isLastTurn && this.me;
		if (o !== undefined) {
			this.calcProbabilityByOfferCondition(o);
			const m = this.getMetrics(o);
			if (m.max <= m.ownValue) {
				//console.log(`max ${m.max}`);
				return { o: undefined };
			}
			const penalty = m.variance / m.eValue + 2 * (this.game.duration - turn) / this.game.duration;
			//console.log(`penalty: `, penalty.toFixed(2));
			//console.log(`variance: `, m.variance.toFixed(2));
			if (m.eValue + penalty * m.variance <= m.ownValue) {
				//console.log(`eValue: ${m.eValue.toFixed(2)}, total: ${(m.eValue + penalty * m.variance).toFixed(2)}`);
				return { o: undefined };
			}
			if (m.ownValue >= 0.7 * this.game.value) {
				//console.log(`good deal`);
				return { o: undefined };
			}
			
			if (isLastWordByMe) {
				//console.log(`eValue: ${m.eValue.toFixed(2)}, total: ${(m.eValue + penalty * m.variance).toFixed(2)}`);
				//console.log(`own: `,m.ownValue);
			}
		}
		let ownOffer = isLastWordByMe ? [] : this.generateOffer(isLastWordByOp);
		return { o: ownOffer };;
	}

	getLastWordOffer(p) {
		let possibleOffers = this.filterPossibleOffers();
		this.game.possibleValues.map((values, i) => {
			//console.log(`pOppositex for values ${values.join()}: ${(this.pOppositeValues[i]).toFixed(3)}`)
		});
		let offersWithWeight = possibleOffers.map((o) => {
			const ownCounts = getOppositeOffer(o, this.game.counts);
			const ownValue = getTotalValue(ownCounts, this.values);
			const opposite = getOppositeOffer(o, this.game.counts);
			const m = this.getMetrics(opposite);

			const wByCount = this.game.value * (this.game.totalCount - getTotalCount(ownCounts)) / this.game.totalCount;

			const w = wByCount + 1.2*ownValue + Math.max((m.eValue), 0);
			//console.log(o,w, wByCount, 1.2*ownValue, Math.max((m.eValue), 0))
			return { w, o, };
		});
		
		offersWithWeight.sort((a,b) => b.w - a.w);
		let offers = offersWithWeight.slice(0, Math.ceil(offersWithWeight.length * p)).map(ow => ow.o);
		//console.log('last: ',offers)
		return offers;
	}

	filterPossibleOffers() {
		let possibleOffers = this.game.possibleOffers.filter((o) => {
			const ownCounts = getOppositeOffer(o, this.game.counts);
			const ownValue = getTotalValue(ownCounts, this.values);
			const opposite = getOppositeOffer(o, this.game.counts);
			const m = this.getMetrics(opposite);

			return ownValue * 2 > this.game.value;
		});
		possibleOffers = possibleOffers.length ? possibleOffers : this.game.possibleOffers;
		let filtredByEvalue = possibleOffers.filter((o) => {
			const ownCounts = getOppositeOffer(o, this.game.counts);
			const ownValue = getTotalValue(ownCounts, this.values);
			const opposite = getOppositeOffer(o, this.game.counts);
			const m = this.getMetrics(opposite);
			const penalty = m.variance / m.eValue + 2 * (this.game.duration - this.turn) / this.game.duration;

			return m.eValue - penalty * m.variance < ownValue;
		});
		return filtredByEvalue.length ? filtredByEvalue : possibleOffers;
	}

	getBestOffers(p) {
		let possibleOffers = this.filterPossibleOffers();
		
		const k = 0.5 * 1.2; // уменьшать с увеличением хода
		let offersWithWeight = possibleOffers.map((o) => {
			const ownCounts = getOppositeOffer(o, this.game.counts);
			const ownValue = getTotalValue(ownCounts, this.values);
			const opposite = getOppositeOffer(o, this.game.counts);
			const m = this.getMetrics(opposite);

			const wByCount = this.game.value * Math.abs((k * this.game.totalCount - getTotalCount(ownCounts))) / this.game.totalCount;

			const w = wByCount + Math.abs(this.game.value/2 - ownValue);
			
			return { w, o, };
		});
		offersWithWeight.sort((a,b) => a.w - b.w);
		let offers = offersWithWeight.slice(0, Math.ceil(offersWithWeight.length * p)).map(ow => ow.o);
		//console.log(this.game.possibleOffers.length, possibleOffers)
		return offers;
	}

	generateOffer(isLastWordByOp) {
		const bestOffers = isLastWordByOp ? this.getLastWordOffer(0.1) : this.getBestOffers(0.3);
		return this.generateRandomOffer(bestOffers);
	}

	generateRandomOffer(offers) {
		return getSample(offers);
	}

}

const countsList = [
	[1,2,3],
	[3,1,1],
	[1,1,1],
	[2,2,2],
	[1,2,2],
]

let gamesList = [];

const startGameSeries = (gCount, oCount) => {
	const resultsByPl = [];
	const dealsByPL = [];
	let games = 0;

	for (let g = 0; g < gCount; g++) {
		let value = 10//getRandomInt(8,12);
		let turns = 5 //getRandomInt(4,6);
		let counts = countsList[g];
		//counts = [1,2,3];
		let game = new Game(counts,value,turns);
		if (game.possibleValues.length == 0) {
			return
		}
		players.forEach((p1,i1) => {
			players.forEach((p2,i2) => {
				let res;
				if (i2 <= i1) {
					return
				}
				const pValues1 = generatePlayer(game);
				const pValues2 = generatePlayer(game);

				game.setPlayers({
					values: pValues1, 
					wFeatures: p1.pl
				}, {
					values: pValues2, 
					wFeatures: p2.pl
				}, 1);
				res = game.startGame();
				if (res) {
					resultsByPl[i1] = resultsByPl[i1] ? resultsByPl[i1] : 0;
					resultsByPl[i1] += res[0];
					resultsByPl[i2] = resultsByPl[i2] ? resultsByPl[i2] : 0;
					resultsByPl[i2] += res[1];

					dealsByPL[i1] = dealsByPL[i1] ? dealsByPL[i1] : 0;
					dealsByPL[i1]++;
					dealsByPL[i2] = dealsByPL[i2] ? dealsByPL[i2] : 0;
					dealsByPL[i2]++;
				}

				game.setPlayers({
					values: pValues2, 
					wFeatures: p2.pl
				}, {
					values: pValues1, 
					wFeatures: p1.pl
				},2);
				res = game.startGame();
				if (res) {
					resultsByPl[i1] = resultsByPl[i1] ? resultsByPl[i1] : 0;
					resultsByPl[i1] += res[1];
					resultsByPl[i2] = resultsByPl[i2] ? resultsByPl[i2] : 0;
					resultsByPl[i2] += res[0];

					dealsByPL[i1] = dealsByPL[i1] ? dealsByPL[i1] : 0;
					dealsByPL[i1]++;
					dealsByPL[i2] = dealsByPL[i2] ? dealsByPL[i2] : 0;
					dealsByPL[i2]++;
				}
			});
		});
		games += 2 * (players.length -1);
	}
	console.log('----------')
	players.forEach((p,i) => {
		const res = resultsByPl[i] || 0;
		p.res = res;
	});
	players.sort((a,b) => b.res - a.res);
	players.forEach((p,i) => {
		const deals = dealsByPL[i] || 0;
		const str = p.pl.reduce((mem, st)=>mem+(mem ? ',' : '')+st.toFixed(3),'')
		console.log(str);
		console.log((p.res/games).toFixed(3), (deals/games).toFixed(3), (p.res/deals).toFixed(3));
	});
}

let players = [{
	pl: [0.2, 0.2, 1,  0.4, 0.5, 0.6, 0.6, 0.4, 0, 4, 2, 1, 1, 2],
	res: 0,
}, {
	pl: [1,   1,   20, 0.8, 1,   0.9, 1,   0.8, 1, 6, 5, 4, 4, 5],
	res: 0,
}];

for (let p = 2; p < 14; p++) {
	const player = [];
	player[0] = getRandomInt(20, 100) / 100;
	player[1] = getRandomInt(20, 100) / 100;
	player[2] = getRandomInt(10, 200) / 10;
	player[3] = getRandomInt(40, 80) / 100;
	player[4] = getRandomInt(50, 100) / 100;
	player[5] = getRandomInt(60, 90) / 100;
	player[6] = getRandomInt(60, 100) / 100;
	player[7] = getRandomInt(40, 80) / 100;
	player[8] = getRandomInt(0, 100) / 100;
	player[9] = getRandomInt(40, 60) / 10;
	player[10] = getRandomInt(20, 50) / 10;
	player[11] = getRandomInt(10, 40) / 10;
	player[12] = getRandomInt(10, 40) / 10;
	player[13] = getRandomInt(20, 50) / 10;
	players.push({
		pl: player,
		res: 0,
	});
}

players = [{
	pl: [1.000,1.000,20.000,0.800,1.000,0.900,1.000,0.800,1.000,6.000,5.000,4.000,4.000,5.000],
	res: 0,
}, {
	pl: [1.190,1.429,11.756,1.720,0.186,0.591,2.803,2.886,2.603,8.025,6.542,3.393,5.702,3.333],
	res: 0,
}, {
	pl: [1.288,2.076, 7.930,0.177,1.456,2.355,2.106,0.066,3.225,5.396,5.696,2.602,2.205,4.958],
	res: 0,
}, {
	pl: [0.605,3.090, 8.098,0.176,1.879,2.793,3.784,0.096,2.977,5.531,5.844,2.652,1.806,5.071],
	res: 0,
}, {
	pl: [1.626,1.207,5.861,0.378,0.610,1.247,2.885,1.349,0.486,5.606,4.111,2.631,3.168,2.950],
	res: 0,
}, {
	pl: [0.885,2.167,8.556,0.138,0.627,1.456,1.807,0.685,2.502,4.638,5.751,1.439,1.808,3.851],
	res: 0,
}, {
	pl: [0.731,1.135,13.012,0.205,3.306,1.538,1.287,0.021,0.602,5.632,4.859,2.272,3.127,3.542],
	res: 0,
}, {
	pl: [-1.933,3.529,9.204,0.475,4.124,0.794,3.503,2.253,1.434,8.084,7.458,5.385,1.088,4.089],
	res: 0,
}, {
	pl: [2.094,2.123,10.236,1.077,0.929,2.121,1.620,2.152,2.487,5.338,4.050,2.864,3.388,3.870],
	res: 0,
}, {
	pl: [1.384,2.135,11.029,0.826,1.054,1.736,2.109,2.393,2.103,5.041,5.160,2.248,3.033,3.643],
	res: 0,
}, {
	pl: [-0.621,0.378,14.382,0.808,0.041,0.529,2.274,3.023,2.942,8.623,5.872,3.322,1.684,4.603],
	res: 0,
}, {
	pl: [0.895,0.332,4.976,0.125,0.223,0.501,1.931,1.742,1.483,3.082,4.486,3.117,1.798,3.889],
	res: 0,
}, {
	pl: [2.683,-0.229,5.064,0.490,1.815,0.495,1.392,1.545,3.529,4.714,4.481,5.911,3.065,4.127],
	res: 0,
}];

for (let j = 0; j < 50; j++) {
	startGameSeries(5, 3);
	for (let p = 5; p < players.length; p++) {
		let index1 = getRandomInt(0, 4);
		let index2 = getRandomInt(0, 4);
		players[p].pl.forEach((w, i) => {
			const mid = (players[index1].pl[i] + players[index2].pl[i]) / 2;
			players[p].pl[i] = getRandomInt(mid - Math.abs(mid - w)/2, mid + Math.abs(mid - w)/2);
		});
	}
}