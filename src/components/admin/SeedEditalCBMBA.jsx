import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_CBMBA_COMPLETO = {
  titulo: "Soldado CBMBA",
  banca: "FCC", // Baseado no estilo do conteúdo programático (Bahia)
  logoUrl: "/logosEditais/logo-cbmba.png",
  instituicao: "CBMBA",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos", relevancia: 5 },
        { nome: "Tipologia textual e gêneros textuais", relevancia: 3 },
        { nome: "Ortografia oficial", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 2 },
        { nome: "Classes de palavras", relevancia: 4 },
        { nome: "Uso do sinal indicativo de crase", relevancia: 5 },
        { nome: "Sintaxe da oração e do período", relevancia: 4 },
        { nome: "Pontuação", relevancia: 4 },
        { nome: "Concordância nominal e verbal", relevancia: 5 },
        { nome: "Regência nominal e verbal", relevancia: 5 },
        { nome: "Significação das palavras", relevancia: 2 }
      ]
    },
    {
      nome: "Matemática",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Conjuntos numéricos (Naturais, Inteiros, Racionais, Reais, Complexos)", relevancia: 3 },
        { nome: "Sequências numéricas: PA e PG", relevancia: 4 },
        { nome: "Álgebra: Expressões, Polinômios e Equações", relevancia: 3 },
        { nome: "Funções: 1º e 2º grau, modular, exponencial, logarítmica", relevancia: 4 },
        { nome: "Sistemas lineares, Matrizes e Determinantes", relevancia: 3 },
        { nome: "Análise Combinatória e Probabilidade", relevancia: 5 }, // Muito importante
        { nome: "Geometria Plana: figuras, congruência, semelhança, perímetro e área", relevancia: 4 },
        { nome: "Geometria Espacial: prisma, pirâmide, cilindro, cone e esfera", relevancia: 4 },
        { nome: "Geometria Analítica: retas, circunferência e distâncias", relevancia: 2 },
        { nome: "Trigonometria: razões, funções, fórmulas e triângulos", relevancia: 3 }
      ]
    },
    {
      nome: "Ciências Naturais",
      peso: 2,
      importancia: "Alta", // Específico para Bombeiros
      assuntos: [
        { nome: "Visão unificada do mundo físico, químico e biológico", relevancia: 2 },
        { nome: "Física: leis e conceitos fundamentais aplicados à vida prática", relevancia: 5 },
        { nome: "Química: identificação de compostos, estruturas e propriedades", relevancia: 4 },
        { nome: "Aplicações modernas de materiais e substâncias químicas", relevancia: 3 },
        { nome: "Cálculos químicos (estequiometria, leis ponderais)", relevancia: 4 },
        { nome: "Biologia: organização da vida e biodiversidade", relevancia: 3 },
        { nome: "Ecossistemas: análise e potencial de utilização", relevancia: 3 },
        { nome: "Ecologia: biosfera, teia da vida e estratégias de sobrevivência", relevancia: 4 },
        { nome: "Interferência do homem nos ecossistemas", relevancia: 4 },
        { nome: "Saúde e vida: epidemias e endemias no Brasil", relevancia: 5 },
        { nome: "Natureza mutável e transformações contínuas", relevancia: 2 },
        { nome: "Tecnologia a serviço do desenvolvimento e manutenção da vida", relevancia: 3 }
      ]
    },
    {
      nome: "Atualidades",
      peso: 1,
      importancia: "Baixa",
      assuntos: [
        { nome: "Globalização: efeitos sociais, econômicos e culturais", relevancia: 5 },
        { nome: "Multiculturalidade, Pluralidade e Diversidade Cultural", relevancia: 3 },
        { nome: "Tecnologias de Informação e Comunicação", relevancia: 4 }
      ]
    },
    {
      nome: "Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Edição de textos, planilhas e apresentações (Office e LibreOffice)", relevancia: 5 },
        { nome: "Sistemas operacionais: Windows e Linux", relevancia: 3 },
        { nome: "Organização e gerenciamento de arquivos e pastas", relevancia: 3 },
        { nome: "Atalhos, ícones e área de trabalho", relevancia: 2 },
        { nome: "Internet e Intranet: conceitos e ferramentas", relevancia: 4 },
        { nome: "Correio eletrônico", relevancia: 3 },
        { nome: "Computação em nuvem", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Poder Constituinte e Princípios fundamentais", relevancia: 2 },
        { nome: "Direitos e garantias fundamentais (Art. 5º)", relevancia: 5 },
        { nome: "Nacionalidade e Direitos políticos", relevancia: 3 },
        { nome: "Organização do Estado (União, Estados, DF, Municípios)", relevancia: 3 },
        { nome: "Administração Pública (Servidores e Militares)", relevancia: 4 },
        { nome: "Poder Legislativo", relevancia: 2 },
        { nome: "Poder Executivo", relevancia: 3 },
        { nome: "Poder Judiciário e Ministério Público", relevancia: 3 },
        { nome: "Defesa do Estado e das Instituições (Forças Armadas e Segurança Pública)", relevancia: 5 }, // Art 144
        { nome: "Constituição da Bahia: servidores militares e segurança pública", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Administração pública: conceito e princípios", relevancia: 4 },
        { nome: "Poderes administrativos", relevancia: 5 },
        { nome: "Atos administrativos: conceito, atributos e classificação", relevancia: 5 },
        { nome: "Organização administrativa (órgãos, entidades, agentes)", relevancia: 3 },
        { nome: "Estatuto dos Policiais Militares da Bahia (Lei 7.990/2001)", relevancia: 5 },
        { nome: "Lei de Organização Básica do CBMBA (Lei 13.202/2014)", relevancia: 5 }, // Específica Bombeiro
        { nome: "Lei de Segurança Contra Incêndio e Pânico (Lei 12.929/2013)", relevancia: 5 }, // Específica Bombeiro
        { nome: "Decreto nº 16.302/2015 (Regulamenta Segurança Contra Incêndio)", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Penal Militar",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Crimes contra autoridade/disciplina: motim, revolta, conspiração", relevancia: 5 },
        { nome: "Violência contra superior ou militar de serviço", relevancia: 4 },
        { nome: "Desrespeito a superior e Recusa de obediência", relevancia: 4 },
        { nome: "Oposição à ordem de sentinela, Reunião ilícita", relevancia: 3 },
        { nome: "Resistência mediante ameaça ou violência", relevancia: 3 },
        { nome: "Crimes contra serviço/dever militar (deserção, abandono, embriaguez, dormir em serviço)", relevancia: 5 },
        { nome: "Crimes contra Adm. Militar (peculato, concussão, corrupção, falsificação)", relevancia: 4 },
        { nome: "Crimes contra o dever funcional: prevaricação", relevancia: 4 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Precedentes históricos (Liga das Nações, OIT)", relevancia: 2 },
        { nome: "Declaração Universal dos Direitos Humanos (1948)", relevancia: 5 },
        { nome: "Convenção Americana (Pacto de São José da Costa Rica)", relevancia: 4 },
        { nome: "Pacto Internacional dos Direitos Econômicos, Sociais e Culturais", relevancia: 3 },
        { nome: "Pacto Internacional dos Direitos Civis e Políticos", relevancia: 3 },
        { nome: "Declaração de Pequim (Direitos das Mulheres)", relevancia: 3 },
        { nome: "Convenção para a Prevenção e Repressão do Genocídio", relevancia: 2 }
      ]
    },
    {
      nome: "Igualdade Racial e de Gênero",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Constituição Federal (Arts. 1º, 3º, 4º e 5º) e da Bahia (Cap. XXIII)", relevancia: 3 },
        { nome: "Estatuto da Igualdade Racial (Lei 12.288/2010)", relevancia: 4 },
        { nome: "Crimes de Preconceito de Raça/Cor (Leis 7.716/89 e 9.459/97)", relevancia: 5 },
        { nome: "Convenções Internacionais contra Discriminação Racial e da Mulher", relevancia: 2 },
        { nome: "Lei Maria da Penha (Lei 11.340/2006)", relevancia: 5 },
        { nome: "Crime de Tortura (Lei 9.455/97)", relevancia: 4 },
        { nome: "Lei Caó (Lei 7.437/85) e Crime de Genocídio", relevancia: 3 },
        { nome: "Legislação Estadual: Secretaria de Promoção da Igualdade Racial", relevancia: 2 },
        { nome: "Legislação Federal: Secretaria de Políticas de Promoção da Igualdade Racial", relevancia: 2 }
      ]
    }
  ]
};

const SeedEditalCBMBA = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital CBMBA (Bombeiro Bahia)?`)) return;

    setLoading(true);
    try {
        // ID do documento no Firestore
        await setDoc(doc(db, "editais_templates", "cbmba_soldado"), EDITAL_CBMBA_COMPLETO);
        alert("Edital CBMBA instalado com sucesso!");
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

// --- CONFIGURAÇÃO MANUAL OBRIGATÓRIA PARA O ADMIN PAGE ---
export const editalConfig = {
    id: "cbmba_soldado",
    titulo: "Soldado CBMBA",
    banca: "FCC",
    tipo: "cbm",
    logo: "/logosEditais/logo-cbmba.png"
};

export default SeedEditalCBMBA;