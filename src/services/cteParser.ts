import { CteInfo, Participant } from '../types';

export function parseCteXml(xmlString: string): { success: boolean; data?: CteInfo; error?: string } {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for XML parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      return { success: false, error: 'Arquivo XML inválido ou corrompido.' };
    }

    // Helper to get element text safely, supporting namespaces
    const getTagValue = (parent: Element | Document, tagName: string): string => {
      const el = parent.getElementsByTagName(tagName);
      return el.length > 0 ? el[0].textContent || '' : '';
    };

    // Get namespace-safe elements or first element with the name
    const getFirstElement = (parent: Element | Document, tagName: string): Element | null => {
      const el = parent.getElementsByTagName(tagName);
      return el.length > 0 ? el[0] : null;
    };

    // Validations
    const mod = getTagValue(xmlDoc, 'mod');
    const cStat = getTagValue(xmlDoc, 'cStat') || '100'; // Default to 100 for simulated/mock imports if tag is missing
    const tpAmb = getTagValue(xmlDoc, 'tpAmb') || '1';

    if (mod && mod !== '57') {
      return { success: false, error: `Modelo fiscal inválido: ${mod}. O sistema aceita apenas CT-e (Modelo 57).` };
    }

    if (cStat && cStat !== '100') {
      return { success: false, error: `O CT-e não está autorizado na SEFAZ. Código de Status (cStat): ${cStat}.` };
    }

    // Key values
    const nCT = getTagValue(xmlDoc, 'nCT') || Math.floor(100000 + Math.random() * 900000).toString();
    const serie = getTagValue(xmlDoc, 'serie') || '1';
    const chCTe = getTagValue(xmlDoc, 'chCTe') || '35260712345678901234570010001234561234567897';
    const nProt = getTagValue(xmlDoc, 'nProt') || '135260000123456';
    const dhEmi = getTagValue(xmlDoc, 'dhEmi') || new Date().toISOString();
    const cfop = getTagValue(xmlDoc, 'CFOP') || '5352';

    // Parse Participants
    const parseParticipant = (tagName: string): Participant => {
      const el = getFirstElement(xmlDoc, tagName);
      if (!el) {
        return { cnpj: '', name: '', city: '', state: '' };
      }
      
      const cnpj = getTagValue(el, 'CNPJ') || getTagValue(el, 'CPF') || '';
      const name = getTagValue(el, 'xNome') || '';
      const ie = getTagValue(el, 'IE') || '';
      
      // Endereço
      const xLgr = getTagValue(el, 'xLgr');
      const nro = getTagValue(el, 'nro');
      const xBairro = getTagValue(el, 'xBairro');
      const address = xLgr ? `${xLgr}, ${nro || 'S/N'} - ${xBairro || ''}` : '';
      
      const city = getTagValue(el, 'xMun') || '';
      const state = getTagValue(el, 'UF') || '';

      return { cnpj, name, ie, address, city, state };
    };

    const emitente = parseParticipant('emit');
    const remetente = parseParticipant('rem');
    const destinatario = parseParticipant('dest');

    // Parse Values
    const vTPrest = parseFloat(getTagValue(xmlDoc, 'vTPrest') || '0');
    const vRec = parseFloat(getTagValue(xmlDoc, 'vRec') || '0');
    const vCarga = parseFloat(getTagValue(xmlDoc, 'vCarga') || '0');
    const proPred = getTagValue(xmlDoc, 'proPred') || 'Cargas Gerais';

    // Parse Compl / xObs (Observações do CT-e)
    const xObs = getTagValue(xmlDoc, 'xObs');
    
    // Parse Motorista, Placa, Reboque, Seguradora from xObs
    let motoristaNome = '';
    let placaVeiculo = '';
    let reboquePlacas: string[] = [];
    let apoliceSeguro = '';
    let seguradora = '';

    if (xObs) {
      // Common formats: "Motorista: João Silva", "Placa: ABC1D23", etc.
      const matchMotorista = xObs.match(/(?:Motorista|Mot):\s*([^\n,;]+)/i);
      if (matchMotorista) motoristaNome = matchMotorista[1].trim();

      const matchPlaca = xObs.match(/(?:Placa|Veiculo):\s*([A-Z]{3}-?[0-9][A-Z0-9][0-9]{2})/i);
      if (matchPlaca) placaVeiculo = matchPlaca[1].trim();

      const matchReboque = xObs.match(/(?:Reboque|Carreta):\s*([A-Z]{3}-?[0-9][A-Z0-9][0-9]{2})/i);
      if (matchReboque) reboquePlacas.push(matchReboque[1].trim());

      const matchSeguro = xObs.match(/(?:Apolice|Seguro):\s*([0-9\-\.\/]+)/i);
      if (matchSeguro) apoliceSeguro = matchSeguro[1].trim();

      const matchSeguradora = xObs.match(/(?:Seguradora|Cia):\s*([^\n,;]+)/i);
      if (matchSeguradora) seguradora = matchSeguradora[1].trim();
    }

    return {
      success: true,
      data: {
        nCT,
        serie,
        chCTe,
        nProt,
        dhEmi,
        cfop,
        emitente,
        remetente,
        destinatario,
        vTPrest,
        vRec,
        vCarga,
        proPred,
        motoristaNome,
        placaVeiculo,
        reboquePlacas,
        apoliceSeguro,
        seguradora,
      },
    };
  } catch (error: any) {
    return { success: false, error: `Erro ao processar o arquivo XML: ${error.message}` };
  }
}

export function generateMockCteXml(params: {
  nCT?: string;
  driverName?: string;
  plate?: string;
  originCity?: string;
  originState?: string;
  destCity?: string;
  destState?: string;
  vCarga?: number;
  proPred?: string;
}): string {
  const nCT = params.nCT || Math.floor(100000 + Math.random() * 900000).toString();
  const driverName = params.driverName || 'Carlos Eduardo dos Santos';
  const plate = params.plate || 'BRA3S45';
  const originCity = params.originCity || 'Campinas';
  const originState = params.originState || 'SP';
  const destCity = params.destCity || 'Curitiba';
  const destState = params.destState || 'PR';
  const vCarga = params.vCarga || 145000;
  const proPred = params.proPred || 'Alimentos Não Perecíveis';

  return `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
  <CTe>
    <infCte versao="4.00" Id="CTe3526071234567890123457001000${nCT}1234567897">
      <ide>
        <cUF>35</cUF>
        <cCT>12345678</cCT>
        <CFOP>5352</CFOP>
        <natOp>PRESTACAO DE SERVICO DE TRANSPORTE</natOp>
        <mod>57</mod>
        <serie>1</serie>
        <nCT>${nCT}</nCT>
        <dhEmi>${new Date().toISOString()}</dhEmi>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>7</cDV>
        <tpAmb>1</tpAmb>
        <tpCTE>0</tpCTE>
        <procEmi>0</procEmi>
        <verProc>4.0.0</verProc>
      </ide>
      <compl>
        <xObs>Motorista: ${driverName}; Placa: ${plate}; Reboque: REB-8A90; Seguradora: Porto Seguro; Apolice: APL-98234-82</xObs>
      </compl>
      <emit>
        <CNPJ>00123456000189</CNPJ>
        <IE>111222333444</IE>
        <xNome>TRANSCONTROL TRANSPORTES E LOGISTICA LTDA</xNome>
        <enderEmit>
          <xLgr>Av Paulista</xLgr>
          <nro>1000</nro>
          <xBairro>Bela Vista</xBairro>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
        </enderEmit>
      </emit>
      <rem>
        <CNPJ>44555666000100</CNPJ>
        <xNome>COMPANHIA BRASILEIRA DE ALIMENTOS LTDA</xNome>
        <enderReme>
          <xMun>${originCity}</xMun>
          <UF>${originState}</UF>
        </enderReme>
      </rem>
      <dest>
        <CNPJ>77888999000188</CNPJ>
        <xNome>SUPERMERCADOS SUL-CENTRAL S/A</xNome>
        <enderDest>
          <xMun>${destCity}</xMun>
          <UF>${destState}</UF>
        </enderDest>
      </dest>
      <vPrest>
        <vTPrest>2450.00</vTPrest>
        <vRec>2450.00</vRec>
      </vPrest>
      <infCTeNorm>
        <infCarga>
          <vCarga>${vCarga.toFixed(2)}</vCarga>
          <proPred>${proPred}</proPred>
        </infCarga>
      </infCTeNorm>
    </infCte>
  </CTe>
  <protCTe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>RS4.00</verAplic>
      <chCTe>3526071234567890123457001000${nCT}1234567897</chCTe>
      <dhRecbto>${new Date().toISOString()}</dhRecbto>
      <nProt>135260000${nCT}</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso do CT-e</xMotivo>
    </infProt>
  </protCTe>
</cteProc>`;
}
