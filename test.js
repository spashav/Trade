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

	calcP_opp(o, p_opp, p_own, me, turn) { // корректировка вероятности p_opp, при условии что оппонент сделал offer и предполагает, что у нас p_own
		const {
			wList,
			totalWeight,
		} = this.rankValuesByOffer(o, p_own, !me, !me ? turn - 1 : turn);
		let offerProbability = this.game.possibleValues.reduce((mem, values, i) => {
			return mem + p_opp[i] * wList[i]/totalWeight;
		}, 0);

		return this.game.possibleValues.map((values, i) => {
			return p_opp[i] * (wList[i]/totalWeight) / offerProbability;
		});
	}

	rankValuesByOffer(o, p_opp, me, turn) {
		let totalWeight = 0;
		let minW = Number.POSITIVE_INFINITY;
		let wList = this.game.possibleValues.map((values) => {
			const w = this.calcWeight(o, values, p_opp, me, turn);
			minW = Math.min(minW, w);
			return w;
		});

		wList = wList.map(w => {
			totalWeight += w + minW;
			return w + minW;
		});

		return {
			wList,
			totalWeight,
		};
	}

	rankBestOffers(values1, values2) {
		return this.game.possibleOffers.map((o, i) => {
			const ownCounts = getOppositeOffer(o, this.game.counts);
			const v1 = getTotalValue(ownCounts, values1);
			const v2 = getTotalValue(o, values2);
			return Math.min(v1, v2);
		});
	}

	calcWeight(o, values, p_opp, me, turn) { // вероятность того, что имея values и зная p_opp, сделаешь о

		const isLastTurn = turn == this.game.duration;
		const isLastWordByOp = isLastTurn && !me;
		const isLastWordByMe = isLastTurn && me;

		const own = getOppositeOffer(o, this.game.counts);
		const ownValue = getTotalValue(own, values);

		let oppValue_e = 0;
		let max_opp = 0;
		let min_opp = this.game.value;
		this.game.possibleValues.forEach((values,i) => {
			const total = getTotalValue(o, values);
			max_opp = Math.max(max_opp, total);
			min_opp = Math.min(min_opp, total);
			oppValue_e += total * p_opp[i];
		});

		let variance_opp = 0;
		this.game.possibleValues.forEach((values,i) => {
			const total = getTotalValue(o, values);
			variance_opp += p_opp[i] * (total - oppValue_e) * (total - oppValue_e);
		});
		variance_opp = Math.sqrt(variance_opp);

		const k = Math.max((this.game.duration - turn) / this.game.duration, 0);

		 return this.game.possibleValues.reduce((mem,v,i) => {
		 	return mem += p_opp[i] * Math.min(ownValue + k * ownValue/2, getTotalValue(o, v));
		 }, 0);

		const features = [
			me ? 1 : 0,
			k,
			ownValue / this.game.value,
			max_opp / this.game.value,
			min_opp / this.game.value,
			oppValue_e / this.game.value,
			variance_opp / this.game.value,
		];
		return features[2] + features[5] - features[1] * features[6];
		return features.reduce((w, f, i) => w + f * this.wFeatures[i], 0);
	}

	rankOffersByValues(values, p_opp, me, turn) {
		let possibleOffers = this.filterPossibleOffers();

		let offersWithWeight = possibleOffers.map((o) => {
			const w = this.calcWeight(o, values, p_opp, me, turn);
			return { w, o, };
		});
		
		offersWithWeight.sort((a,b) => b.w - a.w);

		return offersWithWeight.map(o => o.o);
	}

	// rankValuesByOffer(o, p_opp, me, turn) {
	// 	let totalWeight = 0;
	// 	let minW = Number.POSITIVE_INFINITY;
	// 	let wList = this.game.possibleValues.map((values) => {
	// 		const w = this.calcWeight(o, values, p_opp, me, turn);
	// 		minW = Math.min(minW, w);
	// 		return w;
	// 	});

	// 	wList = wList.map(w => {
	// 		totalWeight += w + minW;
	// 		return w + minW;
	// 	});

	// 	return {
	// 		wList,
	// 		totalWeight,
	// 	};
	// }
	
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
			this.p_opp = this.calcP_opp(o, this.p_opp, this.p_own, this.me, turn);

			const offerAssessment = this.game.possibleValues.reduce((mem, values, i) => {
				
				let w = this.acceptOffer(this.values, o, values, isLastWordByMe, isLastWordByOp);
				const oppP = this.findOpp();
				//isLastWordByMe && console.log(`for ${oppP.values.join()}/${values.join()}: w - ${w.toFixed(2)} p - ${this.p_opp[i].toFixed(2)} me: ${this.values.join()}`);
				return mem + w * this.p_opp[i];
			}, 0);
			
			if (offerAssessment > 0.5) {
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

		if (ownValue >= 0.8) {
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
					return Math.max(0, (8/15 - (oppValue - ownValue)) * (3/2)); // 0.5 - 0.8
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
				return Math.max(0, (0.3 - (oppValue - ownValue)) * 3); // 0.3 - 0.6
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
		let k = 0.1;

		if (ownTotalyAccept && oppTotalyAccept) {
			w = 1 + ownValue + k * oppValue;
		}
		if (ownTotalyAccept && oppPartAccept) {
			w = 3 + ownValue + k * oppValue;
		}
		if (ownPartAccept && oppTotalyAccept) {
			w = 3 + ownValue + k * oppValue;
		}
		if (ownPartAccept && oppPartAccept) {
			w = 2 + ownValue + k * oppValue;
		}
		if (ownTotalyAccept && oppTotalyReject) {
			w = 1 + ownValue + k * oppValue;
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
				return mem + this.getOfferWeight(c_own2, this.values, c_own, values, isLastWordByMe, isLastWordByOp) * this.p_opp[i];
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


const players = [];
for (let p = 0; p < 3; p++) {
	const player = [];
	for (let k = 0; k < 7; k++) {
		player.push(getRandomInt(-50, 50) / 25);
	}
	players.push(player);
}

const startGameSeries = (gCount, oCount) => {
	const resultsByPl = [];
	const dealsByPL = [];
	let games = 0;

	for (let g = 0; g < gCount; g++) {
		let value = 10//getRandomInt(8,12);
		let turns = 5 //getRandomInt(4,6);
		let counts = [];
		for (let c = 0; c < oCount; c++) {
			counts.push(getRandomInt(1,5));
		}
		counts = [1,2,3];
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
					wFeatures: p1
				}, {
					values: pValues2, 
					wFeatures: p2
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
					wFeatures: p2
				}, {
					values: pValues1, 
					wFeatures: p1
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
		const deals = dealsByPL[i] || 0;
		console.log(p, res/games, deals/games, res/deals);
	})
}

startGameSeries(20, 3)