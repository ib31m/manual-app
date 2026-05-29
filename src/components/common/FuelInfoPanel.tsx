import type { FuelOnboard } from '../../domain/types';
import { robByGroup, robBySulphur, SULPHUR_COLOR } from '../../domain/fuelInfo';
import { SULPHUR_LABELS } from '../../data/fuels';

// The manual's "Information" panel: ROB by sulphur category and fuel group.
export function FuelInfoPanel({ fuels, compact }: { fuels: FuelOnboard[]; compact?: boolean }) {
  const bySulphur = robBySulphur(fuels);
  const byGroup = robByGroup(fuels);
  const total = bySulphur.total || 1;

  return (
    <div>
      <div className="info-panel">
        {(['ULS', 'VLS', 'HS'] as const).map((cat) => (
          <div className="info-row" key={cat}>
            <span className="nm" title={SULPHUR_LABELS[cat]}>{cat}</span>
            <span className="bar">
              <span style={{ width: `${(bySulphur[cat] / total) * 100}%`, background: SULPHUR_COLOR[cat] }} />
            </span>
            <span className="amt">{bySulphur[cat].toFixed(1)} mt</span>
          </div>
        ))}
        <div className="info-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 8, fontWeight: 700 }}>
          <span className="nm" style={{ color: 'var(--navy)' }}>Total</span>
          <span className="bar" />
          <span className="amt" style={{ fontWeight: 700 }}>{bySulphur.total.toFixed(1)} mt</span>
        </div>
      </div>

      {!compact && byGroup.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>By fuel group</div>
          <table>
            <tbody>
              {byGroup.map((g) => (
                <tr key={g.group}>
                  <td>{g.group}</td>
                  <td className="num">{g.mt.toFixed(1)} mt</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
