import type { ProductDto } from "@/lib/api/types";

/** Spec-sheet table (design 6.12): 2px top rule, grouped rows, tabular numerals. */
export function SpecTable({ specs }: { specs: ProductDto["specs"] }) {
  if (!specs.length) return null;
  const groups = new Map<string, ProductDto["specs"]>();
  for (const s of specs) {
    const key = s.groupName ?? "";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return (
    <div className="overflow-x-auto">
      <table className="spec-table text-[15px]">
        <tbody>
          {[...groups.entries()].map(([group, rows]) => (
            <FragmentGroup key={group || "_"} group={group} rows={rows} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentGroup({ group, rows }: { group: string; rows: ProductDto["specs"] }) {
  return (
    <>
      {group ? (
        <tr className="bg-[#F1F3F5]">
          <th colSpan={2} scope="colgroup" className="py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#374151]">{group}</th>
        </tr>
      ) : null}
      {rows.map((r) => (
        <tr key={`${group}-${r.label}`}>
          <th scope="row" className="w-[34%] text-sm font-medium text-[#4B5563]">{r.label}</th>
          <td className="font-medium tabular-nums text-foreground">
            {r.value}
            {r.unit ? <span className="ms-1 text-[13px] text-[#6B7280]">{r.unit}</span> : null}
          </td>
        </tr>
      ))}
    </>
  );
}
