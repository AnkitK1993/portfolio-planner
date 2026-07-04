export function fcProjectedAdv(bank, invest, monthly, rate, years, stepUp = 0) {
            const monthRate = rate / 100 / 12;
            const annualStepUp = stepUp / 100;
            let value = bank + invest;
            const totalMonths = Math.round(years * 12);
            for (let m = 0; m < totalMonths; m++) {
              const contrib = monthly * Math.pow(1 + annualStepUp, Math.floor(m / 12));
              value = value * (1 + monthRate) + contrib;
            }
            return value;
          }

export function fcProjected(bank, invest, monthly, rate, T) {
            return fcProjectedAdv(bank, invest, monthly, rate, T, 0);
          }

export function fcTotalInvested(bank, invest, monthly, years, stepUp = 0) {
            const annualStepUp = stepUp / 100;
            let total = bank + invest;
            const totalMonths = Math.round(years * 12);
            for (let m = 0; m < totalMonths; m++) {
              total += monthly * Math.pow(1 + annualStepUp, Math.floor(m / 12));
            }
            return total;
          }

export function fcGoalMonthly(bank, invest, rate, years, stepUp, target) {
            if (years <= 0 || target <= 0) return 0;
            let lo = 0, hi = target * 2;
            for (let i = 0; i < 60; i++) {
              const mid = (lo + hi) / 2;
              if (fcProjectedAdv(bank, invest, mid, rate, years, stepUp) < target) lo = mid;
              else hi = mid;
            }
            return Math.ceil((lo + hi) / 2);
          }
