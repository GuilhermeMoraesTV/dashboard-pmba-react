import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMSE_COMPLETO = {
  titulo: "Soldado PMSE",
  banca: "SELECON (Edital 2024)",
  logoUrl: "/logosEditais/logo-pmse.png",
  instituicao: "PMSE",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Leitura e compreensão de textos variados", relevancia: 5 },
        { nome: "Modos de organização do discurso: descritivo, narrativo, argumentativo, injuntivo, expositivo e dissertativo", relevancia: 3 },
        { nome: "Gêneros do discurso: definição, reconhecimento dos elementos básicos", relevancia: 3 },
        { nome: "Coesão e coerência: mecanismos, efeitos de sentido no texto", relevancia: 4 },
        { nome: "Relação entre as partes do texto: causa, consequência, comparação, conclusão, generalização, exemplificação, particularização", relevancia: 4 },
        { nome: "Conectivos: classificação, uso, efeitos de sentido", relevancia: 5 },
        { nome: "Verbos: pessoa, número, tempo e modo", relevancia: 4 },
        { nome: "Vozes verbais", relevancia: 3 },
        { nome: "Transitividade verbal e nominal", relevancia: 3 },
        { nome: "Estrutura, classificação e formação de palavras", relevancia: 2 },
        { nome: "Funções e classes de palavras", relevancia: 4 },
        { nome: "Flexão nominal e verbal", relevancia: 3 },
        { nome: "Regência verbal e nominal", relevancia: 4 },
        { nome: "Pronomes: emprego, formas de tratamento e colocação", relevancia: 4 },
        { nome: "Figuras de linguagem", relevancia: 2 },
        { nome: "Funções da linguagem", relevancia: 2 },
        { nome: "Sinônimos, antônimos, parônimos e homônimos", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 3 },
        { nome: "Pontuação: regras e efeitos de sentido", relevancia: 4 },
        { nome: "Recursos gráficos: regras, efeitos de sentido", relevancia: 2 },
        { nome: "Sintaxe do Período Simples", relevancia: 3 },
        { nome: "Coordenação e subordinação", relevancia: 5 },
        { nome: "Crase", relevancia: 5 },
        { nome: "Ortografia", relevancia: 3 }
      ]
    },
    {
      nome: "Matemática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Sistema de numeração decimal: classe e ordens", relevancia: 1 },
        { nome: "Números reais: operações (adição, subtração, multiplicação, divisão, potenciação e radiciação)", relevancia: 2 },
        { nome: "Múltiplos e divisores, MDC, MMC, números primos, porcentagem", relevancia: 5 },
        { nome: "Média aritmética e ponderada", relevancia: 3 },
        { nome: "Proporcionalidade direta e inversa. Regra de 3 simples", relevancia: 5 },
        { nome: "Equação e sistema do 1º e 2º grau", relevancia: 4 },
        { nome: "Funções Algébricas: afim, quadrática, exponencial e logarítmica", relevancia: 3 },
        { nome: "Progressão Aritmética e Geométrica", relevancia: 4 },
        { nome: "Análise Combinatória: Princípio Multiplicativo, Arranjos e Combinações", relevancia: 4 },
        { nome: "Sistema legal de medidas: comprimento, área, volume, massa, capacidade e tempo", relevancia: 3 },
        { nome: "Cálculo de áreas das principais figuras planas", relevancia: 4 },
        { nome: "Áreas e volumes dos principais sólidos geométricos", relevancia: 3 },
        { nome: "Comprimento da circunferência", relevancia: 2 },
        { nome: "Relações métricas no triângulo retângulo", relevancia: 3 },
        { nome: "Probabilidade: união de dois eventos, condicional, eventos independentes", relevancia: 5 },
        { nome: "Noções de estatística: interpretação de gráficos e tabelas", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Modalidades de processamento", relevancia: 1 },
        { nome: "Organização e Arquitetura de computadores: hardware, periféricos, armazenamento, conectores", relevancia: 3 },
        { nome: "Software: Software Livre, software básico e utilitários, sistemas operacionais", relevancia: 3 },
        { nome: "Ambientes Windows (XP a 10) e Linux: instalação, configuração, utilitários, comandos", relevancia: 4 },
        { nome: "Sistemas de arquivos, operações, permissões e segurança", relevancia: 3 },
        { nome: "Editores de texto e softwares de apresentação: conceitos e atalhos", relevancia: 4 },
        { nome: "Pacote MS Office (Word, Excel, PowerPoint) e LibreOffice (Writer, Calc, Impress)", relevancia: 5 },
        { nome: "Edição e formatação de textos", relevancia: 4 },
        { nome: "Criação e uso de planilhas de cálculos", relevancia: 5 },
        { nome: "Criação e exibição de apresentações de slides", relevancia: 3 },
        { nome: "Segurança: vírus, antivírus, backup, firewall, criptografia", relevancia: 5 },
        { nome: "Redes Sociais e Computação em nuvem", relevancia: 4 },
        { nome: "Redes de computadores: topologias, tecnologias, TCP/IP, redes cabeadas e wireless", relevancia: 4 },
        { nome: "Internet x Web: navegadores (Edge, Chrome, Firefox), correio eletrônico, busca e pesquisa", relevancia: 4 }
      ]
    },
    {
      nome: "Atualidades",
      peso: 1,
      importancia: "Baixa",
      assuntos: [
        { nome: "Domínio de tópicos atuais", relevancia: 4 },
        { nome: "Atualidades e contextos históricos, geográficos, sociais", relevancia: 4 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Histórico, Direitos Fundamentais, Sociais, Difusos, Civis e Políticos", relevancia: 3 },
        { nome: "Constituição Federal Brasileira de 1988 e suas Emendas", relevancia: 4 },
        { nome: "Título I - Dos Princípios Fundamentais", relevancia: 4 },
        { nome: "Título II - Dos Direitos e Garantias Fundamentais", relevancia: 5 },
        { nome: "Emenda Constitucional nº 45/2004", relevancia: 2 },
        { nome: "Declaração Universal dos Direitos do Homem de 1948 (ONU)", relevancia: 5 },
        { nome: "Convenção Americana de Direitos Humanos", relevancia: 4 },
        { nome: "Decreto nº 4.229/2002 (Programa Nacional de Direitos Humanos - PNDH)", relevancia: 2 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Formação Constitucional do Brasil", relevancia: 2 },
        { nome: "Estrutura e organização do Estado Brasileiro", relevancia: 4 },
        { nome: "Organização dos poderes", relevancia: 3 },
        { nome: "Funções essenciais à justiça", relevancia: 3 },
        { nome: "Artigo 144 da CF/88 (Missão constitucional das Polícias Militares)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Processual Penal",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Inquérito policial", relevancia: 5 },
        { nome: "Ação penal", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios", relevancia: 5 },
        { nome: "Regime jurídico administrativo", relevancia: 3 },
        { nome: "Poderes da administração pública", relevancia: 5 },
        { nome: "Serviço público", relevancia: 3 },
        { nome: "Atos administrativos", relevancia: 5 },
        { nome: "Contratos administrativos e Licitações", relevancia: 3 },
        { nome: "Bens públicos", relevancia: 2 },
        { nome: "Administração direta e indireta", relevancia: 4 },
        { nome: "Controle da administração pública", relevancia: 3 },
        { nome: "Responsabilidade do Estado", relevancia: 4 }
      ]
    },
    {
      nome: "Conhecimentos Gerais de Sergipe",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Indígenas em Sergipe e processo de ocupação", relevancia: 3 },
        { nome: "Economias fundadoras e Regiões geoeconômicas", relevancia: 3 },
        { nome: "Estrutura do poder e sociedade colonial sergipana", relevancia: 3 },
        { nome: "Sergipe nas sucessivas fases da República Brasileira", relevancia: 4 },
        { nome: "Condicionantes geoambientais", relevancia: 5 },
        { nome: "Dinâmica populacional", relevancia: 4 },
        { nome: "Rede urbana e organização do espaço", relevancia: 3 },
        { nome: "Formação metropolitana de Aracaju", relevancia: 4 },
        { nome: "Política, sociedade e economia no Sergipe contemporâneo", relevancia: 4 },
        { nome: "Potencialidades e perspectivas de desenvolvimento", relevancia: 3 },
        { nome: "Formação e expressão da cultura sergipana", relevancia: 5 },
        { nome: "Educação em Sergipe", relevancia: 2 }
      ]
    },
    {
      nome: "Legislação Específica da PMSE",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Estatuto da PMSE (Lei nº 2.066/1976)", relevancia: 5 },
        { nome: "Lei de Remuneração PMSE (Lei nº 5.699/2005)", relevancia: 3 },
        { nome: "Lei de Organização Básica da PMSE (Lei nº 3.669/1995)", relevancia: 4 },
        { nome: "Lei de fixação de efetivo da PMSE (Lei nº 7.823/2014)", relevancia: 2 },
        { nome: "Código de ética e disciplina da PMSE (Lei Complementar nº 291/2017)", relevancia: 5 },
        { nome: "Sistema de Proteção Social dos Militares (Lei Complementar nº 360/2022)", relevancia: 3 }
      ]
    }
  ]
};

const SeedEditalPMSE = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital PMSE 2024?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pmse_soldado"), EDITAL_PMSE_COMPLETO);
        alert("Sucesso! Edital PMSE 2024 mapeado e instalado.");
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
             ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
             : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/20'
         } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
     >
         {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar Edital</>)}
     </button>
   );
 };

// --- CONFIGURAÇÃO MANUAL OBRIGATÓRIA ---
export const editalConfig = {
    id: "pmse_soldado",
    titulo: "Soldado PMSE",
    banca: "SELECON",
    tipo: "pm",
    logo: "/logosEditais/logo-pmse.png"
};

export default SeedEditalPMSE;