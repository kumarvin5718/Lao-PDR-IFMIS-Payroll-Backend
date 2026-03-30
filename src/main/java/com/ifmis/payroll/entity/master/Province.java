package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "province")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Province {

    @Id
    @Column(name = "province_key", nullable = false, updatable = false)
    private String provinceKey;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "country_key", nullable = false)
    private Country country;
}