import React, { useMemo } from 'react';

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00h 00m';
    const totalMinutes = Math.round(d * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

function DisciplineSummaryTable({ registrosEstudo }) {

    // --- useMemo CORRIGIDO ---
    const summary = useMemo(() => {
        const disciplineMap = new Map();

        registrosEstudo.forEach(item => {
            const name = item.disciplinaNome || 'Não Classificado';

            if (!disciplineMap.has(name)) {
                disciplineMap.set(name, {
                    name: name,
                    questions: 0,
                    correct: 0,
                    hours: 0,
                });
            }

            const stats = disciplineMap.get(name);

            // CORREÇÃO: Soma se houver questões
            if (item.questoesFeitas > 0) {
                stats.questions += item.questoesFeitas;
                stats.correct += item.questoesAcertadas;
            }
            // CORREÇÃO: Soma se houver tempo
            if (item.duracaoMinutos > 0) {
                stats.hours += (item.duracaoMinutos / 60); // Converte para horas
            }
        });

        return Array.from(disciplineMap.values())
            .map(item => ({
                ...item,
                performance: item.questions > 0 ? (item.correct / item.questions) * 100 : 0,
            }))
            .sort((a, b) => b.hours - a.hours); // Ordena por mais horas

    }, [registrosEstudo]);
    // --- FIM DA CORREÇÃO ---

    return (
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
            <h3 className="text-xl font-semibold mb-4 text-heading-color dark:text-dark-heading-color">Resumo por Disciplina</h3>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left">
                    <thead>
                        <tr className="border-b border-border-color dark:border-dark-border-color">
                            <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Disciplina</th>
                            <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Tempo</th>
                            <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Questões</th>
                            <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Desempenho</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color dark:divide-dark-border-color">
                        {summary.map((item) => (
                            <tr key={item.name} className="hover:bg-background-color dark:hover:bg-dark-background-color">
                                <td className="p-3 text-text-color dark:text-dark-text-color font-medium">
                                    {item.name}
                                </td>
                                <td className="p-3 text-primary-color font-semibold">
                                    {formatDecimalHours(item.hours)}
                                </td>
                                <td className="p-3 text-text-color dark:text-dark-text-color">
                                    {item.questions}
                                </td>
                                <td className="p-3 text-text-color dark:text-dark-text-color font-semibold">
                                    {item.questions > 0 ? `${item.performance.toFixed(0)}%` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DisciplineSummaryTable;