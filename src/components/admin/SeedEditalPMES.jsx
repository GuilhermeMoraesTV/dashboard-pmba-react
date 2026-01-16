import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMES_COMPLETO = {
  titulo: "Soldado PMES",
  banca: "Instituto AOCP",
  logoUrl: "/logosEditais/logo-pmes.png",
  instituicao: "PMES",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão, interpretação e inferências de textos", relevancia: 5 },
        { nome: "Tipologia e Gêneros textuais", relevancia: 3 },
        { nome: "Variação Linguística", relevancia: 2 },
        { nome: "O processo de comunicação e as funções da linguagem", relevancia: 2 },
        { nome: "Relações semântico-lexicais (metáfora, metonímia, sinonímia, etc.)", relevancia: 4 },
        { nome: "Norma ortográfica", relevancia: 2 },
        { nome: "Morfossintaxe das classes de palavras (substantivo, adjetivo, pronome, verbo, conjunção, etc.)", relevancia: 5 },
        { nome: "Verbo (flexão, tempos e modos)", relevancia: 4 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência nominal e verbal", relevancia: 5 },
        { nome: "Coesão e Coerência textuais", relevancia: 4 },
        { nome: "Sintaxe: orações, períodos (coordenação e subordinação)", relevancia: 5 },
        { nome: "Pontuação", relevancia: 3 },
        { nome: "Funções do “que” e do “se”", relevancia: 4 },
        { nome: "Fonética e Fonologia: som, fonema, encontros vocálicos/consonantais, dígrafos", relevancia: 1 },
        { nome: "Formação de palavras", relevancia: 2 },
        { nome: "Uso da Crase", relevancia: 5 }
      ]
    },
    {
      nome: "Raciocínio Lógico e Matemático",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Estruturas lógicas", relevancia: 4 },
        { nome: "Lógica de argumentação", relevancia: 5 },
        { nome: "Diagramas lógicos", relevancia: 3 },
        { nome: "Teoria de conjuntos: conjuntos numéricos (N, Z, Q, R)", relevancia: 3 },
        { nome: "Relações, Equações de 1º e 2º graus, sistemas", relevancia: 4 },
        { nome: "Inequações do 1º e do 2º grau", relevancia: 3 },
        { nome: "Funções do 1º grau e do 2º grau e sua representação gráfica", relevancia: 4 },
        { nome: "Matrizes e Determinantes", relevancia: 2 },
        { nome: "Sistemas Lineares", relevancia: 3 },
        { nome: "Análise Combinatória", relevancia: 5 },
        { nome: "Geometria espacial", relevancia: 2 },
        { nome: "Geometria de sólidos", relevancia: 2 }
      ]
    },
    {
      nome: "Geografia Geral, Brasil e do Espírito Santo",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "A relação entre movimentos da Terra e a organização do espaço geográfico", relevancia: 2 },
        { nome: "As paisagens mundiais", relevancia: 2 },
        { nome: "A dinâmica da Litosfera, Continentes e oceanos", relevancia: 3 },
        { nome: "Relevo terrestre, Minerais e rochas", relevancia: 3 },
        { nome: "Solos: práticas de manejo e conservação", relevancia: 2 },
        { nome: "Regiões brasileiras, marcas do Brasil em todos os cantos", relevancia: 4 },
        { nome: "Regiões do Espírito Santo (Geografia Regional)", relevancia: 5 },
        { nome: "Dinâmica relação entre componentes das regiões e critérios de delimitação", relevancia: 2 },
        { nome: "Regiões mundiais: geopolíticas, econômicas, Biomas e domínios morfoclimáticos", relevancia: 3 },
        { nome: "Dinâmica da atmosfera: clima, elementos e fatores", relevancia: 3 },
        { nome: "Fenômenos da natureza: alterações antrópicas e dinâmica global-local", relevancia: 3 },
        { nome: "Dinâmica da hidrosfera: água no planeta, bacias hidrográficas, rios, lagos", relevancia: 3 },
        { nome: "Águas oceânicas", relevancia: 1 }
      ]
    },
    {
      nome: "História do Brasil e do Espírito Santo",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "A sociedade colonial: economia, cultura, escravidão, bandeirantes e jesuítas", relevancia: 4 },
        { nome: "A independência e o nascimento do Estado brasileiro", relevancia: 3 },
        { nome: "A organização do Estado monárquico", relevancia: 3 },
        { nome: "A vida intelectual, política e artística no século XIX", relevancia: 2 },
        { nome: "A organização política e econômica do Estado republicano", relevancia: 4 },
        { nome: "A Primeira Guerra Mundial e seus efeitos no Brasil", relevancia: 2 },
        { nome: "A revolução de 1930 e o Período Vargas", relevancia: 5 },
        { nome: "A Segunda Guerra Mundial e seus efeitos no Brasil", relevancia: 2 },
        { nome: "Governos democráticos, governos militares e a Nova República", relevancia: 5 },
        { nome: "A cultura do Brasil Republicano: arte e literatura", relevancia: 2 },
        { nome: "História do Estado do Espírito Santo: colonização, povoamento, sociedade e indústrias", relevancia: 5 }
      ]
    }
  ]
};

const SeedEditalPMES = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMES (Espírito Santo)?`)) return;

    setLoading(true);
    try {
        // ID único para o banco: pmes_soldado
        await setDoc(doc(db, "editais_templates", "pmes_soldado"), EDITAL_PMES_COMPLETO);
        alert("Edital PMES instalado com sucesso!");
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar edital.");
    } finally {
        setLoading(false);
    }
  };

  return (
      <button
          onClick={handleSeed}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${
              isInstalled
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/20'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
          {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar Edital</>)}
      </button>
    );
  };

// --- ALTERAÇÃO: EXPORTAR A CONFIG COMO NAMED EXPORT ---
// Isso resolve o problema de HMR e carregamento dinâmico
export const editalConfig = {
    id: "pmes_soldado",
    titulo: "Soldado PMES",
    banca: "Instituto AOCP",
    tipo: "pm",
    logo: "/logosEditais/logo-pmes.png"
};

export default SeedEditalPMES;